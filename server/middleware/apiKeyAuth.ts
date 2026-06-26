import type { RequestHandler } from "express";
import crypto from "crypto";
import { db } from "../db/db";
import { apiKeys } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger";

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function apiKeyAuth(): RequestHandler {
  return async (req: any, res, next) => {
    const authHeader = req.headers.authorization as string | undefined;
    const rawKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.headers["x-api-key"] as string | undefined;

    if (!rawKey) {
      return res.status(401).json({ message: "API key required", hint: "Pass key in Authorization: Bearer <key> or X-Api-Key header" });
    }

    const keyHash = hashKey(rawKey);
    const [keyRecord] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));

    if (!keyRecord || !keyRecord.isActive) {
      return res.status(401).json({ message: "Invalid or inactive API key" });
    }

    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      return res.status(401).json({ message: "API key expired" });
    }

    // Daily rate limiting — reset count if lastUsedAt is from a previous calendar day
    const now = new Date();
    const lastUsed = keyRecord.lastUsedAt;
    const isNewDay = !lastUsed ||
      lastUsed.getUTCFullYear() !== now.getUTCFullYear() ||
      lastUsed.getUTCMonth()    !== now.getUTCMonth() ||
      lastUsed.getUTCDate()     !== now.getUTCDate();

    const effectiveCount = isNewDay ? 0 : keyRecord.requestCount;

    if (effectiveCount >= keyRecord.dailyLimit) {
      const limit = keyRecord.dailyLimit;
      res.set("X-RateLimit-Limit", String(limit));
      res.set("X-RateLimit-Remaining", "0");
      return res.status(429).json({
        message: "Daily rate limit exceeded",
        limit,
        tier: keyRecord.tier,
        resetsAt: (() => {
          const reset = new Date(now);
          reset.setUTCHours(24, 0, 0, 0);
          return reset.toISOString();
        })(),
        upgrade: "Contact us to upgrade to a higher tier",
      });
    }

    // Increment request count (fire-and-forget); reset to 1 on a new day
    db.update(apiKeys).set({
      requestCount: isNewDay ? 1 : effectiveCount + 1,
      lastUsedAt: now,
    }).where(eq(apiKeys.id, keyRecord.id)).catch(() => {});

    const remaining = keyRecord.dailyLimit - keyRecord.requestCount - 1;
    res.set("X-RateLimit-Limit", String(keyRecord.dailyLimit));
    res.set("X-RateLimit-Remaining", String(remaining));
    res.set("X-RateLimit-Tier", keyRecord.tier);

    req.apiKey = keyRecord;
    req.apiKeyUserId = keyRecord.userId;
    next();
  };
}
