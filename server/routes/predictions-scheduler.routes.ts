/**
 * §28 — Prediction Scheduler API
 * Exposes scheduler status and manual trigger endpoint.
 */

import type { Express } from "express";
import {
  getSchedulerStatus,
  triggerManualRun,
} from "../modules/predictions/prediction-scheduler";
import { authenticateToken } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { logger } from "../utils/logger";

export function registerPredictionSchedulerRoutes(app: Express) {
  // ── GET /api/predictions/scheduler ───────────────────────────────────────
  app.get("/api/predictions/scheduler", authenticateToken, (_req, res) => {
    const status = getSchedulerStatus();
    res.json({
      scheduler: status,
      config: {
        cronExpression:      "*/10 * * * *",
        intervalMinutes:     10,
        spikeThreshold:      3,
        spikeWindowMinutes:  15,
        spikeCooldownMinutes: 5,
        autoExecuteVeryHigh: true,
      },
    });
  });

  // ── POST /api/predictions/scheduler/trigger ───────────────────────────────
  app.post(
    "/api/predictions/scheduler/trigger",
    authenticateToken,
    requireRole("admin", "authority", "super_admin"),
    async (_req, res) => {
      try {
        const status = getSchedulerStatus();
        if (status.isRunning) {
          return res.status(409).json({
            message: "Prediction run already in progress",
            scheduler: status,
          });
        }

        triggerManualRun().catch(() => {});
        res.json({
          ok: true,
          message: "Prediction run triggered",
          triggeredAt: new Date().toISOString(),
        });
      } catch (err) {
        logger.error("Failed to trigger prediction run", err as Error);
        res.status(500).json({ message: "Failed to trigger run" });
      }
    }
  );
}
