import type { Express } from "express";
import { db } from "../db/db";
import { decisions, incidentMetrics, disasterReports } from "@shared/schema";
import { ne, inArray, desc, and, eq, count, avg } from "drizzle-orm";
import { authenticateToken } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { logger } from "../utils/logger";
import { decisionEngine } from "../modules/decisions/decision-engine.service";
import { eventStore, EVENT_TYPES } from "../modules/events/event-store.service";

export function registerDecisionRoutes(app: Express) {
  app.get("/api/decisions", authenticateToken, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const status = req.query.status as string | undefined;
      const type = req.query.type as string | undefined;

      const conditions = [];
      if (status && ["PENDING", "APPROVED", "EXECUTED", "REJECTED"].includes(status)) {
        conditions.push(eq(decisions.status, status as any));
      }
      if (type && ["DISPATCH", "ESCALATE", "BROADCAST", "PREDEPLOY"].includes(type)) {
        conditions.push(eq(decisions.type, type as any));
      }

      const rows = await db
        .select()
        .from(decisions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(decisions.createdAt))
        .limit(limit);

      res.json({ decisions: rows, count: rows.length });
    } catch (error) {
      logger.error("Failed to fetch decisions", error as Error);
      res.status(500).json({ message: "Failed to fetch decisions" });
    }
  });

  app.get("/api/decisions/active", authenticateToken, async (_req, res) => {
    try {
      const rows = await db
        .select()
        .from(decisions)
        .where(inArray(decisions.status, ["PENDING", "APPROVED"]))
        .orderBy(desc(decisions.createdAt))
        .limit(10);

      res.json({ decisions: rows, count: rows.length });
    } catch (error) {
      logger.error("Failed to fetch active decisions", error as Error);
      res.status(500).json({ message: "Failed to fetch active decisions" });
    }
  });

  app.get("/api/decisions/stats", authenticateToken, async (_req, res) => {
    try {
      const [totals] = await db
        .select({ total: count() })
        .from(decisions);

      const [pending] = await db
        .select({ total: count() })
        .from(decisions)
        .where(eq(decisions.status, "PENDING"));

      const [executed] = await db
        .select({ total: count() })
        .from(decisions)
        .where(eq(decisions.status, "EXECUTED"));

      const [autoExec] = await db
        .select({ total: count() })
        .from(decisions)
        .where(and(eq(decisions.autoExecutable, true), eq(decisions.status, "EXECUTED")));

      const [avgConf] = await db
        .select({ val: avg(decisions.confidence) })
        .from(decisions);

      res.json({
        total: totals?.total ?? 0,
        pending: pending?.total ?? 0,
        executed: executed?.total ?? 0,
        autoExecuted: autoExec?.total ?? 0,
        avgConfidence: avgConf?.val ? Math.round(Number(avgConf.val)) : 0,
      });
    } catch (error) {
      logger.error("Failed to fetch decision stats", error as Error);
      res.status(500).json({ message: "Failed to fetch decision stats" });
    }
  });

  app.get("/api/decisions/metrics", authenticateToken, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const rows = await db
        .select()
        .from(incidentMetrics)
        .orderBy(desc(incidentMetrics.detectedAt))
        .limit(limit);

      const enriched = rows.map((m) => {
        const detectionToDecision = m.decisionAt && m.detectedAt
          ? Math.round((m.decisionAt.getTime() - m.detectedAt.getTime()) / 1000)
          : null;
        const decisionToDispatch = m.dispatchedAt && m.decisionAt
          ? Math.round((m.dispatchedAt.getTime() - m.decisionAt.getTime()) / 1000)
          : null;
        const totalResponse = m.dispatchedAt && m.detectedAt
          ? Math.round((m.dispatchedAt.getTime() - m.detectedAt.getTime()) / 1000)
          : null;
        const slaStatus =
          totalResponse === null ? "unknown"
          : totalResponse <= (m.slaTargetSeconds ?? 60) ? "met"
          : totalResponse <= (m.slaTargetSeconds ?? 60) * 1.5 ? "warning"
          : "breached";

        return {
          ...m,
          derived: {
            detectionToDecision,
            decisionToDispatch,
            totalResponse,
            slaStatus,
            slaTarget: m.slaTargetSeconds ?? 60,
          },
        };
      });

      res.json({ metrics: enriched, count: enriched.length });
    } catch (error) {
      logger.error("Failed to fetch incident metrics", error as Error);
      res.status(500).json({ message: "Failed to fetch incident metrics" });
    }
  });

  app.patch(
    "/api/decisions/:id/approve",
    authenticateToken,
    requireRole("admin", "authority", "super_admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const userId = req.user.userId;

        const [dec] = await db
          .select()
          .from(decisions)
          .where(eq(decisions.id, id))
          .limit(1);

        if (!dec) return res.status(404).json({ message: "Decision not found" });
        if (dec.status !== "PENDING") {
          return res.status(409).json({ message: `Cannot approve a decision with status ${dec.status}` });
        }

        await decisionEngine.approveDecision(id, userId);
        await decisionEngine.executeDecision(id, dec.incidentId);

        const [updated] = await db.select().from(decisions).where(eq(decisions.id, id)).limit(1);

        // §26 — Persist to durable event store
        eventStore.append({
          eventType:  EVENT_TYPES.DECISION_EXECUTED,
          entityId:   id,
          entityType: "decision",
          payload: {
            decisionId: id,
            incidentId: dec.incidentId,
            type:       dec.type,
            executedBy: userId,
            executedAt: new Date().toISOString(),
          },
        }).catch(() => {});

        res.json(updated);
      } catch (error) {
        logger.error("Failed to approve decision", error as Error);
        res.status(500).json({ message: "Failed to approve decision" });
      }
    }
  );

  app.patch(
    "/api/decisions/:id/reject",
    authenticateToken,
    requireRole("admin", "authority", "super_admin"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user.userId;

        if (!reason) return res.status(400).json({ message: "Rejection reason is required" });

        const [dec] = await db.select().from(decisions).where(eq(decisions.id, id)).limit(1);
        if (!dec) return res.status(404).json({ message: "Decision not found" });
        if (dec.status !== "PENDING") {
          return res.status(409).json({ message: `Cannot reject a decision with status ${dec.status}` });
        }

        await decisionEngine.rejectDecision(id, userId, reason);
        const [updated] = await db.select().from(decisions).where(eq(decisions.id, id)).limit(1);

        // §26 — Persist to durable event store
        eventStore.append({
          eventType:  EVENT_TYPES.DECISION_REJECTED,
          entityId:   id,
          entityType: "decision",
          payload: {
            decisionId: id,
            incidentId: dec.incidentId,
            rejectedBy: userId,
            reason,
            rejectedAt: new Date().toISOString(),
          },
        }).catch(() => {});

        res.json(updated);
      } catch (error) {
        logger.error("Failed to reject decision", error as Error);
        res.status(500).json({ message: "Failed to reject decision" });
      }
    }
  );
}
