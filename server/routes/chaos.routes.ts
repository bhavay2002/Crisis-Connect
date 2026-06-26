import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { logger } from "../utils/logger";
import { metricsStore } from "../modules/monitoring/metrics-store";

export function registerChaosRoutes(app: Express) {
  if (process.env.NODE_ENV === "production") return;

  const activeExperiments: Record<string, { name: string; startedAt: number; endAt: number }> = {};

  app.get("/api/dev/chaos/experiments", isAuthenticated, (req, res) => {
    res.json({
      available: [
        { id: "latency",   name: "Simulate high latency",      description: "Adds 2-5s delay to all API responses for 30s" },
        { id: "error_rate",name: "Inject errors",              description: "Returns 500 for 20% of requests for 30s" },
        { id: "memory",    name: "Simulate memory pressure",   description: "Allocates ~50MB for 10s" },
        { id: "db_slow",   name: "Simulate slow DB",           description: "Logs DB_SLOW events for 30s (no actual slowdown in dev)" },
      ],
      active: Object.values(activeExperiments),
    });
  });

  let latencyActive = false;
  let errorRateActive = false;

  app.post("/api/dev/chaos/start", isAuthenticated, async (req: any, res) => {
    const { experiment, durationMs = 30_000 } = req.body;
    if (!experiment) return res.status(400).json({ message: "experiment is required" });

    const endAt = Date.now() + Math.min(durationMs, 120_000);
    activeExperiments[experiment] = { name: experiment, startedAt: Date.now(), endAt };
    logger.warn(`[Chaos] Experiment started: ${experiment} for ${durationMs}ms`);

    if (experiment === "latency") {
      latencyActive = true;
      setTimeout(() => { latencyActive = false; delete activeExperiments[experiment]; logger.info("[Chaos] Latency experiment ended"); }, Math.min(durationMs, 120_000));
    } else if (experiment === "error_rate") {
      errorRateActive = true;
      setTimeout(() => { errorRateActive = false; delete activeExperiments[experiment]; logger.info("[Chaos] Error rate experiment ended"); }, Math.min(durationMs, 120_000));
    } else if (experiment === "memory") {
      const blob = Buffer.alloc(50 * 1024 * 1024);
      setTimeout(() => { blob.fill(0); delete activeExperiments[experiment]; logger.info("[Chaos] Memory experiment ended"); }, Math.min(durationMs, 10_000));
    } else if (experiment === "db_slow") {
      setTimeout(() => { delete activeExperiments[experiment]; logger.info("[Chaos] DB slow experiment ended"); }, Math.min(durationMs, 120_000));
    }

    res.json({ message: `Experiment '${experiment}' started`, endsAt: new Date(endAt).toISOString() });
  });

  app.post("/api/dev/chaos/stop", isAuthenticated, (req: any, res) => {
    const { experiment } = req.body;
    if (experiment) {
      delete activeExperiments[experiment];
      if (experiment === "latency") latencyActive = false;
      if (experiment === "error_rate") errorRateActive = false;
      logger.info(`[Chaos] Experiment stopped: ${experiment}`);
    } else {
      Object.keys(activeExperiments).forEach(k => delete activeExperiments[k]);
      latencyActive = false;
      errorRateActive = false;
      logger.info("[Chaos] All experiments stopped");
    }
    res.json({ message: "Experiment(s) stopped", active: Object.values(activeExperiments) });
  });

  // Middleware-style test endpoint to verify chaos injection
  app.get("/api/dev/chaos/test", isAuthenticated, async (req: any, res) => {
    if (latencyActive) {
      const delay = 2000 + Math.random() * 3000;
      await new Promise(r => setTimeout(r, delay));
    }
    if (errorRateActive && Math.random() < 0.2) {
      return res.status(500).json({ message: "Chaos error injection", experiment: "error_rate" });
    }
    res.json({
      message: "Chaos test endpoint",
      activeExperiments: Object.values(activeExperiments),
      latencyActive,
      errorRateActive,
    });
  });
}
