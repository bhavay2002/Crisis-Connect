/**
 * Pipeline & System Health Routes — §21
 *
 * Exposes live observability data for the async AI pipeline:
 *   GET /api/system/pipeline        — queue + worker + pubsub + WS stats
 *   GET /api/reports/:id/ai-status  — per-report AI processing status
 */

import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { jobQueue } from "../utils/jobQueue";
import { pubSub, CHANNELS } from "../utils/pubsub";
import { workerMetrics } from "../workers/ai-analysis.worker";
import { storage } from "../db/storage";
import { logger } from "../utils/logger";

// Injected by index.ts after WS setup
let getWsClientCount: () => number = () => 0;
let getRoomCount:     () => number = () => 0;

export function setWsStatsProviders(
  clientCount: () => number,
  roomCount:   () => number
) {
  getWsClientCount = clientCount;
  getRoomCount     = roomCount;
}

export function registerPipelineRoutes(app: Express) {

  // ── Full pipeline health ─────────────────────────────────────────────────
  app.get("/api/system/pipeline", isAuthenticated, requireRole("admin", "super_admin", "authority"), async (_req, res) => {
    try {
      const queueStatus = jobQueue.getQueueStatus();
      const pubSubMode  = pubSub.getMode();
      const pubSubStats = (pubSub as any).getStats?.() ?? { channels: pubSub.getChannels().length };

      res.json({
        queue: {
          depth:              queueStatus.queueLength,
          processing:         queueStatus.processing,
          concurrency:        queueStatus.concurrency,
          isRunning:          queueStatus.isRunning,
          registeredHandlers: queueStatus.registeredHandlers,
          // §24 — Load shedding fields
          loadLevel:          queueStatus.loadLevel,
          isUnderLoad:        queueStatus.isUnderLoad,
          shedCount:          queueStatus.shedCount,
          maxQueueSize:       queueStatus.maxQueueSize,
          shedThreshold:      queueStatus.shedThreshold,
        },
        aiWorker: {
          processed:   workerMetrics.processed,
          failed:      workerMetrics.failed,
          avgLatencyMs: workerMetrics.avgMs,
          recentJobs:  workerMetrics.recent.slice(0, 10),
          successRate: workerMetrics.processed + workerMetrics.failed > 0
            ? parseFloat(((workerMetrics.processed / (workerMetrics.processed + workerMetrics.failed)) * 100).toFixed(1))
            : 100,
        },
        websocket: {
          connectedClients: getWsClientCount(),
          rooms:            getRoomCount(),
          mode:             "raw-ws",
        },
        pubsub: {
          mode:     pubSubMode,
          ...pubSubStats,
          channels: pubSub.getChannels(),
          redisReady: pubSubMode === "redis",
          upgradeInstructions: pubSubMode === "in-memory"
            ? "Set REDIS_URL env var to enable Redis pub/sub for multi-instance deployment"
            : null,
        },
        architecture: {
          asyncAIPipeline: true,
          multiInstanceReady: pubSubMode === "redis",
          queueBackend: "in-memory (JobQueue)",
          retryStrategy: "exponential, max 3 attempts",
          idempotencyKey: "reportId",
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error("Pipeline stats failed", err as Error);
      res.status(500).json({ message: "Failed to fetch pipeline stats" });
    }
  });

  // ── Per-report AI status ─────────────────────────────────────────────────
  app.get("/api/reports/:id/ai-status", isAuthenticated, async (req, res) => {
    try {
      const report = await storage.getDisasterReport(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      const isPending   = report.aiValidationScore === null;
      const isProcessing = !isPending
        ? false
        : jobQueue.getQueueStatus().processing > 0; // rough heuristic

      res.json({
        reportId:          report.id,
        aiStatus:          isPending ? "pending" : "completed",
        aiValidationScore: report.aiValidationScore,
        aiValidationNotes: report.aiValidationNotes,
        isProcessing,
        completedAt:       isPending ? null : report.updatedAt,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to get AI status" });
    }
  });

  // ── Worker metrics only ──────────────────────────────────────────────────
  app.get("/api/system/pipeline/worker", isAuthenticated, requireRole("admin", "super_admin"), (_req, res) => {
    res.json({
      processed:    workerMetrics.processed,
      failed:       workerMetrics.failed,
      avgLatencyMs: workerMetrics.avgMs,
      successRate:  workerMetrics.processed + workerMetrics.failed > 0
        ? parseFloat(((workerMetrics.processed / (workerMetrics.processed + workerMetrics.failed)) * 100).toFixed(1))
        : 100,
      recent: workerMetrics.recent,
    });
  });
}
