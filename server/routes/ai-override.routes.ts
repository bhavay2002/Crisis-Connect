import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { db } from "../db/db";
import { aiOverrides, disasterReports } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { logger } from "../utils/logger";

export function registerAIOverrideRoutes(app: Express) {
  // List all AI decisions requiring review
  app.get("/api/ai-overrides", isAuthenticated, requireRole("admin", "authority", "super_admin"), async (req: any, res) => {
    try {
      const status = req.query.status as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      const rows = status
        ? await db.select().from(aiOverrides).where(eq(aiOverrides.status, status as any)).orderBy(desc(aiOverrides.createdAt)).limit(limit)
        : await db.select().from(aiOverrides).orderBy(desc(aiOverrides.createdAt)).limit(limit);

      res.json({ overrides: rows, count: rows.length });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single override detail
  app.get("/api/ai-overrides/:id", isAuthenticated, async (req: any, res) => {
    try {
      const [row] = await db.select().from(aiOverrides).where(eq(aiOverrides.id, req.params.id));
      if (!row) return res.status(404).json({ message: "Override record not found" });
      res.json(row);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin override an AI decision
  app.patch("/api/ai-overrides/:id/review", isAuthenticated, requireRole("admin", "authority", "super_admin"), async (req: any, res) => {
    try {
      const { action, overriddenDecision, reason, notes } = req.body;
      if (!action || !["approve", "override"].includes(action)) {
        return res.status(400).json({ message: "action must be 'approve' or 'override'" });
      }
      if (action === "override" && !overriddenDecision) {
        return res.status(400).json({ message: "overriddenDecision is required when action=override" });
      }

      const [existing] = await db.select().from(aiOverrides).where(eq(aiOverrides.id, req.params.id));
      if (!existing) return res.status(404).json({ message: "Override record not found" });

      const [updated] = await db.update(aiOverrides).set({
        status: action === "approve" ? "approved" : "overridden",
        overriddenDecision: action === "override" ? overriddenDecision : existing.originalDecision,
        overriddenBy: req.user.userId,
        reason,
        notes,
        reviewedAt: new Date(),
      }).where(eq(aiOverrides.id, req.params.id)).returning();

      // If overriding a disaster report, update its severity/type
      if (action === "override" && existing.incidentType === "disaster_report" && overriddenDecision?.severity) {
        await db.update(disasterReports)
          .set({ severity: overriddenDecision.severity, type: overriddenDecision.crisisType || undefined })
          .where(eq(disasterReports.id, existing.incidentId))
          .catch(() => {});
      }

      logger.info(`[AIOverride] ${action} on ${existing.incidentId} by ${req.user.userId}`, { reason });
      res.json(updated);
    } catch (err) {
      logger.error("AI override review failed", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create an AI decision record for a report (trigger human review flow)
  app.post("/api/ai-overrides", isAuthenticated, async (req: any, res) => {
    try {
      const { incidentId, incidentType = "disaster_report", originalDecision, aiConfidence, aiUrgency } = req.body;
      if (!incidentId || !originalDecision) {
        return res.status(400).json({ message: "incidentId and originalDecision are required" });
      }

      const confidence = parseFloat(aiConfidence ?? "0.5");
      const urgency = parseFloat(aiUrgency ?? "0.5");
      const requiresHumanReview = confidence < 0.7 || urgency >= 0.85 || originalDecision.severity === "critical";

      const [record] = await db.insert(aiOverrides).values({
        incidentId, incidentType, originalDecision,
        aiConfidence: String(confidence),
        aiUrgency: String(urgency),
        requiresHumanReview,
        status: requiresHumanReview ? "pending_review" : "auto_approved",
      }).returning();

      res.status(201).json(record);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Stats: pending review count, approval rate, override rate
  app.get("/api/ai-overrides/stats/summary", isAuthenticated, async (req: any, res) => {
    try {
      const [total, pending, approved, overridden] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(aiOverrides).then(r => Number(r[0]?.count ?? 0)),
        db.select({ count: sql<number>`count(*)` }).from(aiOverrides).where(eq(aiOverrides.status, "pending_review")).then(r => Number(r[0]?.count ?? 0)),
        db.select({ count: sql<number>`count(*)` }).from(aiOverrides).where(eq(aiOverrides.status, "approved")).then(r => Number(r[0]?.count ?? 0)),
        db.select({ count: sql<number>`count(*)` }).from(aiOverrides).where(eq(aiOverrides.status, "overridden")).then(r => Number(r[0]?.count ?? 0)),
      ]);
      res.json({ total, pending, approved, overridden, autoApproved: total - pending - approved - overridden, overrideRate: total > 0 ? parseFloat(((overridden / total) * 100).toFixed(1)) : 0 });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
