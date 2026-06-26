/**
 * §23 — Decision Loop Closure
 * POST /api/decisions/:id/outcome  — record the real-world outcome of an executed decision
 *
 * Flow:
 *   operator records outcome (SUCCESS / DELAYED / FAILED)
 *     → persisted in decision_outcomes table
 *     → outcome.recorded event emitted on pubSub
 *     → adaptive weights SGD step triggered (isRealCrisis inferred from outcome)
 */

import type { Express } from "express";
import { db } from "../db/db";
import { decisions, decisionOutcomes } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { authenticateToken } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { pubSub } from "../utils/pubsub";
import { outcomeCollector } from "../modules/fusion/outcome-collector.service";
import { eventStore, EVENT_TYPES } from "../modules/events/event-store.service";
import { logger } from "../utils/logger";

export function registerDecisionOutcomeRoutes(app: Express) {
  // ── POST /api/decisions/:id/outcome ────────────────────────────────────────
  // Record the real-world outcome of a decision (SUCCESS / DELAYED / FAILED)
  app.post(
    "/api/decisions/:id/outcome",
    authenticateToken,
    requireRole("admin", "authority", "super_admin"),
    async (req: any, res) => {
      try {
        const { id: decisionId } = req.params;
        const { outcome, responseTimeSec, actionTaken, effectiveness, notes } = req.body;

        if (!outcome || !["SUCCESS", "DELAYED", "FAILED"].includes(outcome)) {
          return res.status(400).json({
            message: "outcome must be one of: SUCCESS, DELAYED, FAILED",
          });
        }

        // Verify decision exists and is EXECUTED
        const [dec] = await db
          .select()
          .from(decisions)
          .where(eq(decisions.id, decisionId))
          .limit(1);

        if (!dec) {
          return res.status(404).json({ message: "Decision not found" });
        }
        if (dec.status !== "EXECUTED") {
          return res.status(409).json({
            message: `Cannot record outcome for a decision with status ${dec.status} — must be EXECUTED`,
          });
        }

        // Check for duplicate (idempotent)
        const [existing] = await db
          .select()
          .from(decisionOutcomes)
          .where(eq(decisionOutcomes.decisionId, decisionId))
          .limit(1);

        if (existing) {
          return res.status(409).json({
            message: "Outcome already recorded for this decision",
            existing,
          });
        }

        // Persist the outcome
        const [recorded] = await db
          .insert(decisionOutcomes)
          .values({
            decisionId,
            incidentId:      dec.incidentId,
            outcome,
            responseTimeSec: responseTimeSec ?? null,
            actionTaken:     actionTaken ?? dec.type,
            effectiveness:   effectiveness ?? null,
            notes:           notes ?? null,
            recordedBy:      req.user.userId,
          })
          .returning();

        logger.info("[DecisionOutcome] Outcome recorded", {
          decisionId,
          incidentId: dec.incidentId,
          outcome,
          effectiveness,
        });

        // ── Emit outcome.recorded for analytics + real-time subscribers ──────
        pubSub.publish("outcome.recorded", {
          decisionId,
          incidentId: dec.incidentId,
          outcome,
          responseTimeSec: responseTimeSec ?? null,
          recordedAt:      recorded.createdAt,
        });

        // §26 — Persist to durable event store (survives process restart, replayable)
        eventStore.append({
          eventType:  EVENT_TYPES.OUTCOME_RECORDED,
          entityId:   decisionId,
          entityType: "decision",
          payload: {
            decisionId,
            incidentId:      dec.incidentId,
            outcome,
            responseTimeSec: responseTimeSec ?? null,
            effectiveness:   effectiveness ?? null,
            isRealCrisis:    outcome === "SUCCESS" || outcome === "DELAYED",
            recordedBy:      req.user.userId,
            recordedAt:      new Date().toISOString(),
          },
        }).catch(() => {});

        // ── Wire to adaptive weights learning loop ────────────────────────────
        // Infer signal-level ground truth from decision outcome:
        //   SUCCESS → the fusion model was correct to flag this as a crisis
        //   FAILED  → the decision was wrong (false positive) — penalize weights
        //   DELAYED → partial credit (treat as real crisis for SGD purposes)
        const isRealCrisis = outcome === "SUCCESS" || outcome === "DELAYED";
        const isFalsePositive = outcome === "FAILED";

        outcomeCollector.record(dec.incidentId, isRealCrisis, {
          falsePositive: isFalsePositive,
          responseTimeSec: responseTimeSec ?? undefined,
          labelSource: "manual",
          labeledBy: req.user.userId,
        }).catch((err) => {
          // Non-fatal — outcome is already persisted, SGD update failed
          logger.error("[DecisionOutcome] SGD update failed (non-fatal)", err as Error, {
            decisionId,
            incidentId: dec.incidentId,
          });
        });

        res.status(201).json({
          ok: true,
          outcome: recorded,
          learning: {
            isRealCrisis,
            sgdTriggered: true,
            note: isRealCrisis
              ? "Marked as real crisis — model weights will reinforce signal features"
              : "Marked as false positive — model weights will be penalized",
          },
        });
      } catch (error) {
        logger.error("Failed to record decision outcome", error as Error);
        res.status(500).json({ message: "Failed to record outcome" });
      }
    }
  );

  // ── GET /api/decisions/:id/outcome ─────────────────────────────────────────
  // Fetch the recorded outcome for a specific decision
  app.get(
    "/api/decisions/:id/outcome",
    authenticateToken,
    async (req, res) => {
      try {
        const { id: decisionId } = req.params;

        const [outcome] = await db
          .select()
          .from(decisionOutcomes)
          .where(eq(decisionOutcomes.decisionId, decisionId))
          .limit(1);

        if (!outcome) {
          return res.status(404).json({ message: "No outcome recorded for this decision" });
        }

        res.json(outcome);
      } catch (error) {
        logger.error("Failed to fetch decision outcome", error as Error);
        res.status(500).json({ message: "Failed to fetch outcome" });
      }
    }
  );

  // ── GET /api/decisions/outcomes/recent ─────────────────────────────────────
  // Fetch recent decision outcomes for the dashboard
  app.get(
    "/api/decisions/outcomes/recent",
    authenticateToken,
    async (req, res) => {
      try {
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

        const rows = await db
          .select()
          .from(decisionOutcomes)
          .orderBy(desc(decisionOutcomes.createdAt))
          .limit(limit);

        const successCount = rows.filter(r => r.outcome === "SUCCESS").length;
        const delayedCount = rows.filter(r => r.outcome === "DELAYED").length;
        const failedCount  = rows.filter(r => r.outcome === "FAILED").length;

        const avgResponseTime = rows
          .filter(r => r.responseTimeSec !== null)
          .reduce((sum, r, _, arr) => sum + (r.responseTimeSec ?? 0) / arr.length, 0);

        res.json({
          outcomes: rows,
          count:    rows.length,
          summary: {
            successCount,
            delayedCount,
            failedCount,
            successRate: rows.length > 0 ? Math.round((successCount / rows.length) * 100) : null,
            avgResponseTimeSec: rows.length > 0 ? Math.round(avgResponseTime) : null,
          },
        });
      } catch (error) {
        logger.error("Failed to fetch recent decision outcomes", error as Error);
        res.status(500).json({ message: "Failed to fetch outcomes" });
      }
    }
  );
}
