import type { Express } from "express";
import crypto from "crypto";
import { isAuthenticated } from "../middleware/jwtAuth";
import { apiKeyAuth } from "../middleware/apiKeyAuth";
import { db } from "../db/db";
import { apiKeys, webhookSubscriptions, webhookDeliveries, disasterReports, sosAlerts } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { dispatchWebhookEvent } from "../modules/webhooks/webhook-dispatcher";
import { logger } from "../utils/logger";

function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = "cc_" + crypto.randomBytes(24).toString("hex");
  const prefix = key.slice(0, 12);
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  return { key, prefix, hash };
}

const TIER_LIMITS: Record<string, number> = { free: 100, paid: 10_000, enterprise: 1_000_000 };

export function registerDeveloperPlatformRoutes(app: Express) {
  // ── API Keys ───────────────────────────────────────────────────────────────
  app.post("/api/developer/keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { name, tier = "free", expiresInDays } = req.body;
      if (!name) return res.status(400).json({ message: "name is required" });

      const existing = await db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
      if (existing.length >= 10) return res.status(400).json({ message: "Maximum 10 API keys per account" });

      const { key, prefix, hash } = generateApiKey();
      const dailyLimit = TIER_LIMITS[tier] || 100;
      const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : undefined;

      const [record] = await db.insert(apiKeys).values({
        userId, name, keyHash: hash, keyPrefix: prefix, tier, dailyLimit, expiresAt,
      }).returning();

      logger.info(`API key created`, { userId, keyId: record.id, tier });
      res.status(201).json({
        ...record,
        key,
        warning: "Store this key securely — it will not be shown again",
      });
    } catch (err) {
      logger.error("API key creation failed", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/developer/keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const keys = await db.select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        tier: apiKeys.tier,
        dailyLimit: apiKeys.dailyLimit,
        requestCount: apiKeys.requestCount,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
        expiresAt: apiKeys.expiresAt,
      }).from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
      res.json({ keys });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/developer/keys/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const [key] = await db.select().from(apiKeys)
        .where(and(eq(apiKeys.id, req.params.id), eq(apiKeys.userId, userId)));
      if (!key) return res.status(404).json({ message: "Key not found" });
      await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, req.params.id));
      res.json({ message: "API key revoked" });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reset daily request count (admin / dev utility)
  app.post("/api/developer/keys/:id/reset", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      await db.update(apiKeys)
        .set({ requestCount: 0 })
        .where(and(eq(apiKeys.id, req.params.id), eq(apiKeys.userId, userId)));
      res.json({ message: "Request count reset" });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Webhooks ───────────────────────────────────────────────────────────────
  app.post("/api/developer/webhooks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { url, events } = req.body;
      if (!url || !events?.length) return res.status(400).json({ message: "url and events[] are required" });
      try { new URL(url); } catch { return res.status(400).json({ message: "Invalid URL" }); }

      const secret = "whsec_" + crypto.randomBytes(20).toString("hex");
      const [sub] = await db.insert(webhookSubscriptions).values({ userId, url, events, secret }).returning();
      res.status(201).json({
        ...sub,
        warning: "Store the secret securely — it is used to verify webhook signatures",
      });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/developer/webhooks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const subs = await db.select({
        id: webhookSubscriptions.id,
        url: webhookSubscriptions.url,
        events: webhookSubscriptions.events,
        isActive: webhookSubscriptions.isActive,
        failureCount: webhookSubscriptions.failureCount,
        lastDeliveredAt: webhookSubscriptions.lastDeliveredAt,
        createdAt: webhookSubscriptions.createdAt,
      }).from(webhookSubscriptions)
        .where(eq(webhookSubscriptions.userId, userId))
        .orderBy(desc(webhookSubscriptions.createdAt));
      res.json({ webhooks: subs });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/developer/webhooks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      await db.delete(webhookSubscriptions)
        .where(and(eq(webhookSubscriptions.id, req.params.id), eq(webhookSubscriptions.userId, userId)));
      res.json({ message: "Webhook deleted" });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/developer/webhooks/:id/deliveries", isAuthenticated, async (req: any, res) => {
    try {
      const deliveries = await db.select().from(webhookDeliveries)
        .where(eq(webhookDeliveries.subscriptionId, req.params.id))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(50);
      res.json({ deliveries });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Test webhook delivery
  app.post("/api/developer/webhooks/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      await dispatchWebhookEvent("crisis.created", {
        id: "test-" + Date.now(),
        type: "test",
        severity: "medium",
        message: "CrisisConnect webhook test delivery",
      });
      res.json({ message: "Test event dispatched" });
    } catch (err) {
      res.status(500).json({ message: "Test dispatch failed" });
    }
  });

  // ── Public v1 API (API key authenticated) ──────────────────────────────────
  // Valid enum values for mapping
  const VALID_TYPES = ["fire","flood","earthquake","storm","road_accident","epidemic","landslide","gas_leak","building_collapse","chemical_spill","power_outage","water_contamination","other"] as const;
  const VALID_SEVERITIES = ["low","medium","high","critical"] as const;

  // POST /v1/crisis/report
  app.post("/v1/crisis/report", apiKeyAuth(), async (req: any, res) => {
    try {
      const { message, location, type, severity, latitude, longitude } = req.body;
      if (!message || !location) return res.status(400).json({ message: "message and location are required" });

      const safeType = VALID_TYPES.includes(type) ? type : "other";
      const safeSeverity = VALID_SEVERITIES.includes(severity) ? severity : "medium";

      const [report] = await db.insert(disasterReports).values({
        userId: req.apiKeyUserId,
        title: message.slice(0, 200),
        type: safeType,
        severity: safeSeverity,
        location,
        latitude: latitude ? String(latitude) : null,
        longitude: longitude ? String(longitude) : null,
        description: message,
        status: "reported",
      } as any).returning();

      dispatchWebhookEvent("crisis.created", {
        id: report.id, type: report.type, severity: report.severity, location: report.location,
      }).catch(() => {});

      res.status(201).json({
        id: report.id,
        status: report.status,
        type: report.type,
        severity: report.severity,
        location: report.location,
        createdAt: report.createdAt,
      });
    } catch (err) {
      logger.error("v1 crisis report failed", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /v1/crisis/alerts
  app.get("/v1/crisis/alerts", apiKeyAuth(), async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const reports = await db.select().from(disasterReports)
        .orderBy(desc(disasterReports.createdAt))
        .limit(limit);
      res.json({
        alerts: reports.map(r => ({
          id: r.id, type: r.type, severity: r.severity, location: r.location,
          status: r.status, createdAt: r.createdAt,
        })),
        count: reports.length,
      });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /v1/crisis/:id
  app.get("/v1/crisis/:id", apiKeyAuth(), async (req: any, res) => {
    try {
      const [report] = await db.select().from(disasterReports)
        .where(eq(disasterReports.id, req.params.id));
      if (!report) return res.status(404).json({ message: "Incident not found" });
      res.json({
        id: report.id, type: report.type, severity: report.severity, location: report.location,
        status: report.status, description: report.description, latitude: report.latitude,
        longitude: report.longitude, createdAt: report.createdAt, updatedAt: report.updatedAt,
      });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
