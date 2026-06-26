import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { authorize } from "../middleware/authorize";
import { db } from "../db/db";
import {
  users,
  disasterReports,
  sosAlerts,
  userConsents,
  resourceRequests,
  incidentLogs,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "../utils/logger";

export function registerComplianceRoutes(app: Express) {
  // ──────────────────────────────────────────────
  // GDPR: Export own data
  // ──────────────────────────────────────────────
  app.get("/api/compliance/me/export", isAuthenticated, authorize("data:export_own"), async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ message: "User not found" });

      const [reports, alerts, requests, consents] = await Promise.all([
        db.select().from(disasterReports).where(eq(disasterReports.userId, userId)),
        db.select().from(sosAlerts).where(eq(sosAlerts.userId, userId)),
        db.select().from(resourceRequests).where(eq(resourceRequests.userId, userId)),
        db.select().from(userConsents).where(eq(userConsents.userId, userId)),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        profile: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          phoneNumber: user.phoneNumber,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        disasterReports: reports.map(r => ({
          id: r.id,
          type: r.type,
          severity: r.severity,
          location: r.location,
          status: r.status,
          createdAt: r.createdAt,
        })),
        sosAlerts: alerts.map(a => ({
          id: a.id,
          location: a.location,
          status: a.status,
          createdAt: a.createdAt,
        })),
        resourceRequests: requests.map(r => ({
          id: r.id,
          resourceType: r.resourceType,
          quantity: r.quantity,
          status: r.status,
          createdAt: r.createdAt,
        })),
        consents: consents.map(c => ({
          consentType: c.consentType,
          granted: c.granted,
          grantedAt: c.grantedAt,
          revokedAt: c.revokedAt,
          version: c.version,
        })),
      };

      logger.info(`GDPR data export`, { userId });
      res.setHeader("Content-Disposition", `attachment; filename="crisisconnect-export-${userId.slice(0, 8)}.json"`);
      res.json(exportData);
    } catch (err) {
      logger.error("GDPR export failed", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Export failed" });
    }
  });

  // ──────────────────────────────────────────────
  // GDPR: Delete own account
  // ──────────────────────────────────────────────
  app.delete("/api/compliance/me/account", isAuthenticated, authorize("data:delete_own"), async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { confirm } = req.body;
      if (confirm !== "DELETE_MY_ACCOUNT") {
        return res.status(400).json({ message: "Must confirm with 'DELETE_MY_ACCOUNT'" });
      }

      // Anonymize reports (keep records but strip user identity per GDPR)
      await db.update(disasterReports)
        .set({ userId: null } as any)
        .where(eq(disasterReports.userId, userId));
      await db.update(sosAlerts)
        .set({ userId: null } as any)
        .where(eq(sosAlerts.userId, userId));

      // Hard-delete user (cascades to consents via FK)
      await db.delete(users).where(eq(users.id, userId));

      logger.info(`GDPR account deletion`, { userId, action: "account_deleted" });
      res.json({ message: "Account deleted. Your reports have been anonymized." });
    } catch (err) {
      logger.error("GDPR account deletion failed", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Deletion failed" });
    }
  });

  // ──────────────────────────────────────────────
  // GDPR: Record user consent
  // ──────────────────────────────────────────────
  app.post("/api/compliance/me/consent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { consentType, granted, version = "1.0" } = req.body;
      if (!consentType || granted === undefined) {
        return res.status(400).json({ message: "consentType and granted are required" });
      }
      const [consent] = await db
        .insert(userConsents)
        .values({
          userId,
          consentType,
          granted: !!granted,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          version,
          grantedAt: new Date(),
          revokedAt: granted ? null : new Date(),
        })
        .returning();
      res.status(201).json(consent);
    } catch (err) {
      logger.error("Consent record failed", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Failed to record consent" });
    }
  });

  // GDPR: Get my consents
  app.get("/api/compliance/me/consents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const consents = await db
        .select()
        .from(userConsents)
        .where(eq(userConsents.userId, userId))
        .orderBy(desc(userConsents.grantedAt));
      res.json({ consents });
    } catch (err) {
      logger.error("Failed to fetch consents", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ──────────────────────────────────────────────
  // Admin: Data retention policy
  // ──────────────────────────────────────────────
  app.get("/api/compliance/data-retention", isAuthenticated, authorize("data:retention_manage"), async (req: any, res) => {
    const policy = {
      policyVersion: "1.0",
      lastReviewed: "2026-05-01",
      retentionRules: [
        { dataType: "disaster_reports",    retainDays: 3650, anonymizeAfterDays: 1825, legalBasis: "public_interest" },
        { dataType: "sos_alerts",          retainDays: 1825, anonymizeAfterDays: 365,  legalBasis: "vital_interests" },
        { dataType: "audit_logs",          retainDays: 2555, anonymizeAfterDays: null, legalBasis: "legal_obligation" },
        { dataType: "chat_messages",       retainDays: 365,  anonymizeAfterDays: 180,  legalBasis: "contract" },
        { dataType: "device_fingerprints", retainDays: 90,   anonymizeAfterDays: null, legalBasis: "legitimate_interest" },
        { dataType: "user_profiles",       retainDays: null, anonymizeAfterDays: null, legalBasis: "contract", note: "Retained until deletion request" },
        { dataType: "user_consents",       retainDays: 3650, anonymizeAfterDays: null, legalBasis: "legal_obligation" },
      ],
      userRights: ["access", "rectification", "erasure", "portability", "restriction", "objection"],
      dpa: "privacy@crisisconnect.example",
    };
    res.json(policy);
  });

  // ──────────────────────────────────────────────
  // Admin: Audit trail for user actions
  // ──────────────────────────────────────────────
  app.get("/api/compliance/audit-trail", isAuthenticated, authorize("data:retention_manage"), async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;
      const targetUserId = req.query.userId as string | undefined;

      let query = db
        .select()
        .from(incidentLogs)
        .orderBy(desc(incidentLogs.timestamp))
        .limit(limit)
        .offset(offset);

      const logs = await (targetUserId
        ? db.select().from(incidentLogs)
            .where(eq(incidentLogs.triggeredBy, targetUserId))
            .orderBy(desc(incidentLogs.timestamp))
            .limit(limit).offset(offset)
        : query);

      res.json({ logs, limit, offset, total: logs.length });
    } catch (err) {
      logger.error("Audit trail failed", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
