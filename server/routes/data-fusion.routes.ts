import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { getFusionStats } from "../modules/fusion/data-fusion.service";
import {
  getCachedFusionSignals,
  getCachedReportFusion,
  getSignalFreshnessStatus,
  invalidateCache,
} from "../modules/fusion/signal-cache.service";
import { logger } from "../utils/logger";

export function registerDataFusionRoutes(app: Express) {
  // ── GET /api/fusion/signals ────────────────────────────────────────────────
  // §27: Now cache-backed with stale-data resilience fields
  app.get("/api/fusion/signals", isAuthenticated, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const { results, stale, cacheAgeSeconds, lastFetchedAt, dataSource } =
        await getCachedFusionSignals(limit);

      // §27: Expose freshness via response header so clients can react
      res.set("X-Data-Age", String(cacheAgeSeconds));
      res.set("X-Data-Source", dataSource);
      if (stale) res.set("X-Data-Stale", "true");

      res.json({
        results,
        count:           results.length,
        generatedAt:     new Date().toISOString(),
        // §27 degraded-mode contract
        stale,
        cacheAgeSeconds,
        lastFetchedAt,
        dataSource,
        degradedMode:    stale,
      });
    } catch (err) {
      logger.error("Fusion signals failed", err instanceof Error ? err : undefined);
      res.status(503).json({
        message:     "Fusion signal service unavailable",
        stale:       true,
        degradedMode: true,
      });
    }
  });

  // ── GET /api/fusion/stats ──────────────────────────────────────────────────
  app.get("/api/fusion/stats", isAuthenticated, async (_req, res) => {
    try {
      const stats = await getFusionStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch fusion stats" });
    }
  });

  // ── GET /api/fusion/analyze/:reportId ─────────────────────────────────────
  // §27: Now cache-backed per-report
  app.get("/api/fusion/analyze/:reportId", isAuthenticated, async (req, res) => {
    try {
      const { result, stale, cacheAgeSeconds, dataSource } =
        await getCachedReportFusion(req.params.reportId);

      if (!result) return res.status(404).json({ message: "Report not found" });

      res.set("X-Data-Age", String(cacheAgeSeconds));
      res.set("X-Data-Source", dataSource);
      if (stale) res.set("X-Data-Stale", "true");

      res.json({
        ...result,
        stale,
        cacheAgeSeconds,
        dataSource,
      });
    } catch (err) {
      logger.error("Fusion analysis failed", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Fusion analysis failed" });
    }
  });

  // ── GET /api/fusion/freshness ──────────────────────────────────────────────
  // §27: Per-source cache freshness status
  app.get("/api/fusion/freshness", isAuthenticated, (_req, res) => {
    const status = getSignalFreshnessStatus();
    res.json({
      ...status,
      // Degraded if any source has failures
      degraded: Object.values(status.sources).some(s => !s.healthy),
      checkedAt: new Date().toISOString(),
    });
  });

  // ── POST /api/fusion/cache/invalidate ─────────────────────────────────────
  // Admin: force fresh fetch on next request
  app.post("/api/fusion/cache/invalidate", isAuthenticated, (req, res) => {
    const { reportId } = req.body;
    invalidateCache(reportId);
    res.json({
      ok:          true,
      scope:       reportId ? `report:${reportId}` : "all",
      invalidatedAt: new Date().toISOString(),
    });
  });
}
