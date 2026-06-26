import type { RequestHandler } from "express";
import { metricsStore } from "../modules/monitoring/metrics-store";

export function metricsMiddleware(): RequestHandler {
  return (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const route = req.route?.path || req.path || "unknown";
      metricsStore.record({
        method: req.method,
        route,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        timestamp: Date.now(),
      });
    });
    next();
  };
}
