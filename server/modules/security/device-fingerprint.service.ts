import { db } from "../../db/db";
import { deviceFingerprints } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { logger } from "../../utils/logger";

export interface FingerprintResult {
  riskScore: number;
  isFlagged: boolean;
  flagReason?: string;
  requestCount: number;
}

export class DeviceFingerprintService {
  private readonly HIGH_FREQUENCY_THRESHOLD = 50;
  private readonly FLAG_RISK_THRESHOLD = 70;

  buildHash(ipAddress: string, userAgent: string = ""): string {
    return createHash("sha256")
      .update(`${ipAddress}|${userAgent.slice(0, 200)}`)
      .digest("hex")
      .slice(0, 64);
  }

  async upsert(data: {
    userId?: string;
    ipAddress: string;
    userAgent?: string;
  }): Promise<FingerprintResult> {
    const hash = this.buildHash(data.ipAddress, data.userAgent);

    try {
      const existing = await db
        .select()
        .from(deviceFingerprints)
        .where(eq(deviceFingerprints.fingerprintHash, hash));

      if (existing[0]) {
        const rec = existing[0];
        const newCount = rec.requestCount + 1;
        let riskScore = rec.riskScore;
        let isFlagged = rec.isFlagged;
        let flagReason = rec.flagReason;

        if (newCount > this.HIGH_FREQUENCY_THRESHOLD && riskScore < 80) {
          riskScore = Math.min(100, riskScore + 10);
        }

        if (data.userId && rec.userId && rec.userId !== data.userId) {
          riskScore = Math.min(100, riskScore + 30);
          flagReason = "multiple_accounts_same_device";
          isFlagged = riskScore >= this.FLAG_RISK_THRESHOLD;
          logger.warn("Device fingerprint: multiple user accounts detected", {
            hash: hash.slice(0, 12),
            existingUser: rec.userId,
            newUser: data.userId,
            riskScore,
          });
        }

        isFlagged = isFlagged || riskScore >= this.FLAG_RISK_THRESHOLD;

        const [updated] = await db
          .update(deviceFingerprints)
          .set({
            userId: data.userId || rec.userId,
            requestCount: newCount,
            riskScore,
            isFlagged,
            flagReason: flagReason || rec.flagReason,
            lastSeenAt: new Date(),
          })
          .where(eq(deviceFingerprints.id, rec.id))
          .returning();

        return {
          riskScore: updated.riskScore,
          isFlagged: updated.isFlagged,
          flagReason: updated.flagReason || undefined,
          requestCount: updated.requestCount,
        };
      }

      const [created] = await db
        .insert(deviceFingerprints)
        .values({
          userId: data.userId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          fingerprintHash: hash,
          riskScore: 0,
          requestCount: 1,
          isFlagged: false,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        })
        .returning();

      return {
        riskScore: created.riskScore,
        isFlagged: created.isFlagged,
        requestCount: created.requestCount,
      };
    } catch (error) {
      logger.error("Device fingerprint upsert error", error as Error);
      return { riskScore: 0, isFlagged: false, requestCount: 1 };
    }
  }

  async getByUser(userId: string) {
    return db
      .select()
      .from(deviceFingerprints)
      .where(eq(deviceFingerprints.userId, userId));
  }

  async getFlaggedDevices() {
    return db
      .select()
      .from(deviceFingerprints)
      .where(eq(deviceFingerprints.isFlagged, true));
  }

  async getHighRiskDevices(minRisk: number = 60) {
    return db
      .select()
      .from(deviceFingerprints)
      .where(sql`${deviceFingerprints.riskScore} >= ${minRisk}`);
  }
}

export const deviceFingerprintService = new DeviceFingerprintService();
