import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { metricsStore } from "../modules/monitoring/metrics-store";
import { circuitBreakers } from "../modules/resilience/circuit-breaker";
import { db } from "../db/db";
import { disasterReports, sosAlerts, users } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import { logger } from "../utils/logger";

export function registerMonitoringRoutes(app: Express) {
  // Prometheus-format metrics endpoint
  app.get("/api/metrics", async (req: any, res) => {
    const apiKey = req.headers["x-api-key"] || req.headers.authorization?.replace("Bearer ", "");
    if (process.env.NODE_ENV === "production" && !apiKey) {
      return res.status(401).send("# Unauthorized\n");
    }
    res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(metricsStore.toPrometheus());
  });

  // Enhanced health check
  app.get("/api/health/detailed", async (req, res) => {
    const checks: Record<string, { status: "ok" | "degraded" | "down"; detail?: string }> = {};

    // Database check
    try {
      await db.execute(sql`SELECT 1`);
      checks.database = { status: "ok" };
    } catch (err) {
      checks.database = { status: "down", detail: (err as Error).message };
    }

    // Memory check
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
    const heapPct = heapUsedMb / heapTotalMb;
    checks.memory = {
      status: heapPct > 0.9 ? "degraded" : "ok",
      detail: `${heapUsedMb}MB / ${heapTotalMb}MB (${Math.round(heapPct * 100)}%)`,
    };

    // Circuit breakers
    const openBreakers = Object.values(circuitBreakers).filter(cb => cb.getStatus().state === "OPEN");
    checks.circuitBreakers = {
      status: openBreakers.length > 0 ? "degraded" : "ok",
      detail: openBreakers.length > 0
        ? `OPEN: ${openBreakers.map(cb => cb.getStatus().name).join(", ")}`
        : `All ${Object.keys(circuitBreakers).length} breakers CLOSED`,
    };

    const overallStatus = Object.values(checks).some(c => c.status === "down") ? "down"
      : Object.values(checks).some(c => c.status === "degraded") ? "degraded"
      : "ok";

    res.status(overallStatus === "down" ? 503 : 200).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      checks,
      metrics: metricsStore.getSummary(),
    });
  });

  // Platform statistics dashboard
  app.get("/api/monitoring/stats", isAuthenticated, async (req: any, res) => {
    try {
      const [reportCount, sosCount, userCount] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(disasterReports).then(r => Number(r[0]?.count ?? 0)),
        db.select({ count: sql<number>`count(*)` }).from(sosAlerts).then(r => Number(r[0]?.count ?? 0)),
        db.select({ count: sql<number>`count(*)` }).from(users).then(r => Number(r[0]?.count ?? 0)),
      ]);

      res.json({
        platform: {
          totalReports: reportCount,
          totalSOS: sosCount,
          totalUsers: userCount,
        },
        runtime: metricsStore.getSummary(),
        circuitBreakers: Object.values(circuitBreakers).map(cb => cb.getStatus()),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error("Monitoring stats failed", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Alerting thresholds check
  app.get("/api/monitoring/alerts", isAuthenticated, async (req: any, res) => {
    const summary = metricsStore.getSummary();
    const alerts: { level: "info" | "warn" | "critical"; message: string }[] = [];

    if (summary.errorRate > 10) alerts.push({ level: "critical", message: `Error rate ${summary.errorRate.toFixed(1)}% exceeds 10% threshold` });
    else if (summary.errorRate > 5) alerts.push({ level: "warn", message: `Error rate ${summary.errorRate.toFixed(1)}% exceeds 5% threshold` });

    if (summary.avgResponseTimeMs > 2000) alerts.push({ level: "critical", message: `Avg response ${summary.avgResponseTimeMs}ms exceeds 2000ms threshold` });
    else if (summary.avgResponseTimeMs > 1000) alerts.push({ level: "warn", message: `Avg response ${summary.avgResponseTimeMs}ms exceeds 1000ms threshold` });

    const openBreakers = Object.values(circuitBreakers).filter(cb => cb.getStatus().state === "OPEN");
    if (openBreakers.length > 0) {
      alerts.push({ level: "warn", message: `Circuit breakers OPEN: ${openBreakers.map(cb => cb.getStatus().name).join(", ")}` });
    }

    if (alerts.length === 0) alerts.push({ level: "info", message: "All systems nominal" });
    res.json({ alerts, evaluatedAt: new Date().toISOString() });
  });
}
