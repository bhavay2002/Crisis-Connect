/**
 * Worker-only entry point — for Kubernetes worker pods
 *
 * This starts the job queue, AI analysis handlers, and prediction scheduler
 * WITHOUT starting an HTTP server. Designed to run as a separate deployment
 * that scales independently from the API pods.
 *
 * Usage:  node dist/worker.js
 * Build:  esbuild server/worker.ts --platform=node --packages=external
 *                                  --bundle --format=esm --outdir=dist
 */

import { logger } from "./utils/logger";
import { db } from "./db/db";
import { adaptiveWeights } from "./modules/fusion/adaptive-weights.service";
import {
  startPredictionScheduler,
  getSchedulerStatus,
} from "./modules/predictions/prediction-scheduler";

// ── Graceful shutdown ─────────────────────────────────────────────────────────

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`[Worker] Received ${signal} — shutting down gracefully`);

  setTimeout(() => {
    logger.warn("[Worker] Forced shutdown after 10s");
    process.exit(1);
  }, 10_000);

  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("uncaughtException",  (err) => {
  logger.error("[Worker] Uncaught exception", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error("[Worker] Unhandled rejection", reason as Error);
  process.exit(1);
});

// ── Startup ───────────────────────────────────────────────────────────────────

async function startWorker() {
  logger.info("[Worker] CrisisConnect worker process starting", {
    nodeVersion: process.version,
    pid: process.pid,
  });

  // Verify DB connectivity
  try {
    await db.execute("SELECT 1" as any);
    logger.info("[Worker] Database connection verified");
  } catch (err) {
    logger.error("[Worker] Database connection failed", err as Error);
    process.exit(1);
  }

  // Initialize adaptive weights model
  await adaptiveWeights.initialize().catch((err) => {
    logger.warn("[Worker] Adaptive weights init failed — using static weights", {
      error: String(err),
    });
  });

  // Register AI analysis job handlers
  // Workers share the same jobQueue singleton; handlers registered here
  // will process jobs dispatched by the API pods (requires Redis-backed queue
  // for true multi-pod isolation — see docs/scaling.md).
  const { jobQueue } = await import("./utils/jobQueue");
  const { registerAIAnalysisWorker } = await import("./workers/ai-analysis.worker");
  registerAIAnalysisWorker();

  logger.info("[Worker] AI analysis job handler registered");

  // Start prediction cron scheduler (every 10 min + spike detection)
  startPredictionScheduler();
  const status = getSchedulerStatus();
  logger.info("[Worker] Prediction scheduler started", {
    cronExpression: status.cronExpression,
    nextRunAt: status.nextRunAt,
  });

  logger.info("[Worker] All systems ready — processing jobs");
}

startWorker().catch((err) => {
  logger.error("[Worker] Fatal startup error", err);
  process.exit(1);
});
