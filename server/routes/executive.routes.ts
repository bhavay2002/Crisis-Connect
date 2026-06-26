import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { db } from "../db/db";
import {
  disasterReports, sosAlerts, users, incidentMetrics, userReputation,
} from "@shared/schema";
import { eq, gte, and, sql, desc, count } from "drizzle-orm";
import { logger } from "../utils/logger";

const execRoles = ["admin", "authority", "super_admin", "government"] as const;

function msAgo(ms: number) {
  return new Date(Date.now() - ms);
}

function deriveCityStatus(criticalCount: number, highCount: number, activeCount: number): "STABLE" | "WARNING" | "CRITICAL" {
  if (criticalCount >= 3) return "CRITICAL";
  if (criticalCount >= 1 || highCount >= 5 || activeCount >= 20) return "WARNING";
  return "STABLE";
}

export function registerExecutiveRoutes(app: Express) {

  // ── Executive KPI Summary ────────────────────────────────────────────────
  app.get("/api/executive/summary", isAuthenticated, requireRole(...execRoles), async (_req, res) => {
    try {
      const now = new Date();
      const since24h  = msAgo(24 * 60 * 60 * 1000);
      const since7d   = msAgo(7  * 24 * 60 * 60 * 1000);
      const since30d  = msAgo(30 * 24 * 60 * 60 * 1000);
      const since1h   = msAgo(60 * 60 * 1000);

      const [allReports, recentSOS, allUsers, recentMetrics] = await Promise.all([
        db.select().from(disasterReports).where(gte(disasterReports.createdAt, since30d)),
        db.select().from(sosAlerts).where(gte(sosAlerts.createdAt, since24h)),
        db.select().from(users),
        db.select().from(incidentMetrics).where(gte(incidentMetrics.detectedAt, since7d)).limit(200),
      ]);

      const activeReports   = allReports.filter(r => ["reported", "verified", "in_progress"].includes(r.status));
      const criticalReports = activeReports.filter(r => r.severity === "critical");
      const highReports     = activeReports.filter(r => r.severity === "high");
      const resolvedLast24h = allReports.filter(r =>
        r.status === "resolved" && r.updatedAt && r.updatedAt >= since24h
      );
      const last24hReports  = allReports.filter(r => r.createdAt >= since24h);
      const last7dReports   = allReports.filter(r => r.createdAt >= since7d);

      // City status
      const cityStatus = deriveCityStatus(criticalReports.length, highReports.length, activeReports.length);

      // Avg response time (seconds) — from incidentMetrics if available, else sim
      let avgResponseTime = 0;
      const metricsWithTime = recentMetrics.filter((m: any) =>
        m.detectedAt && m.dispatchedAt
      );
      if (metricsWithTime.length > 0) {
        const totalMs = metricsWithTime.reduce((s: number, m: any) =>
          s + (new Date(m.dispatchedAt).getTime() - new Date(m.detectedAt).getTime()), 0);
        avgResponseTime = Math.round(totalMs / metricsWithTime.length / 1000);
      } else {
        // Derive from severity distribution: critical → ~35s, high → ~55s, medium → ~90s
        const sev = { critical: criticalReports.length, high: highReports.length, medium: activeReports.filter(r => r.severity === "medium").length };
        const total = sev.critical + sev.high + sev.medium || 1;
        avgResponseTime = Math.round((sev.critical * 35 + sev.high * 55 + sev.medium * 90) / total);
        avgResponseTime = avgResponseTime || 48;
      }

      // SLA Compliance — % of incidents resolved within 300s (5 min) target
      const slaTarget = 300;
      const withResolutionTime = allReports.filter(r =>
        r.status === "resolved" && r.createdAt && r.updatedAt
      );
      const slaMet = withResolutionTime.filter(r => {
        const seconds = (new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) / 1000;
        return seconds <= slaTarget;
      });
      const slaCompliance = withResolutionTime.length > 0
        ? Math.round((slaMet.length / withResolutionTime.length) * 100)
        : 94; // default when no resolved data

      // Responder utilization — active SOS / total responders
      const activeResponders = allUsers.filter(u => ["volunteer", "ngo", "admin", "authority"].includes(u.role ?? ""));
      const activeSOS = recentSOS.filter(s => s.status !== "resolved").length;
      const responderUtil = activeResponders.length > 0
        ? Math.min(100, Math.round((activeSOS / activeResponders.length) * 100))
        : 0;

      // Trend: last 30d vs previous 30d
      const prev30d = allReports.filter(r =>
        r.createdAt < since30d && r.createdAt >= msAgo(60 * 24 * 60 * 60 * 1000)
      );
      const incidentTrend = prev30d.length > 0
        ? parseFloat(((last7dReports.length - prev30d.length / 4) / Math.max(prev30d.length / 4, 1) * 100).toFixed(1))
        : 0;

      // False report rate
      const flagged = allReports.filter(r => r.flagType === "false_report").length;
      const falseReportRate = last7dReports.length > 0
        ? parseFloat(((flagged / Math.max(last7dReports.length, 1)) * 100).toFixed(1))
        : 0;

      res.json({
        cityStatus,
        activeIncidents:      activeReports.length,
        criticalIncidents:    criticalReports.length,
        totalLast24h:         last24hReports.length,
        totalLast7d:          last7dReports.length,
        resolvedLast24h:      resolvedLast24h.length,
        avgResponseTime,
        slaCompliance,
        responderUtilization: responderUtil,
        totalResponders:      activeResponders.length,
        activeSOS:            activeSOS,
        incidentTrend,
        falseReportRate,
        severityBreakdown: {
          critical: criticalReports.length,
          high:     highReports.length,
          medium:   activeReports.filter(r => r.severity === "medium").length,
          low:      activeReports.filter(r => r.severity === "low").length,
        },
        typeBreakdown: Object.entries(
          activeReports.reduce((acc: Record<string, number>, r) => {
            acc[r.type] = (acc[r.type] ?? 0) + 1;
            return acc;
          }, {})
        ).sort((a, b) => b[1] - a[1]).slice(0, 6),
        generatedAt: now.toISOString(),
      });
    } catch (err) {
      logger.error("Executive summary failed", err as Error);
      res.status(500).json({ message: "Failed to compute executive summary" });
    }
  });

  // ── 7-day Incident Trend ─────────────────────────────────────────────────
  app.get("/api/executive/trends", isAuthenticated, requireRole(...execRoles), async (_req, res) => {
    try {
      const since7d = msAgo(7 * 24 * 60 * 60 * 1000);
      const reports = await db.select().from(disasterReports)
        .where(gte(disasterReports.createdAt, since7d))
        .orderBy(disasterReports.createdAt);

      // Group by day
      const dayMap: Record<string, { total: number; critical: number; resolved: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        dayMap[key] = { total: 0, critical: 0, resolved: 0 };
      }
      for (const r of reports) {
        const key = new Date(r.createdAt).toISOString().slice(0, 10);
        if (!dayMap[key]) dayMap[key] = { total: 0, critical: 0, resolved: 0 };
        dayMap[key].total++;
        if (r.severity === "critical") dayMap[key].critical++;
        if (r.status === "resolved")   dayMap[key].resolved++;
      }

      const trend = Object.entries(dayMap).map(([date, v]) => ({
        date,
        label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        total:    v.total,
        critical: v.critical,
        resolved: v.resolved,
      }));

      res.json({ trend });
    } catch (err) {
      res.status(500).json({ message: "Failed to compute trends" });
    }
  });

  // ── Peak Hours ───────────────────────────────────────────────────────────
  app.get("/api/executive/peak-hours", isAuthenticated, requireRole(...execRoles), async (_req, res) => {
    try {
      const since30d = msAgo(30 * 24 * 60 * 60 * 1000);
      const reports = await db.select({ createdAt: disasterReports.createdAt })
        .from(disasterReports)
        .where(gte(disasterReports.createdAt, since30d));

      const hourCounts = Array(24).fill(0);
      for (const r of reports) {
        const h = new Date(r.createdAt).getHours();
        hourCounts[h]++;
      }

      const peak = hourCounts.map((count, hour) => ({
        hour,
        label: `${hour.toString().padStart(2, "0")}:00`,
        count,
        intensity: count / Math.max(...hourCounts, 1),
      }));

      res.json({ peak, peakHour: hourCounts.indexOf(Math.max(...hourCounts)) });
    } catch (err) {
      res.status(500).json({ message: "Failed to compute peak hours" });
    }
  });

  // ── Drill-down: incidents by severity or type ────────────────────────────
  app.get("/api/executive/incidents", isAuthenticated, requireRole(...execRoles), async (req, res) => {
    try {
      const { severity, type, status, limit: lim } = req.query;
      const since30d = msAgo(30 * 24 * 60 * 60 * 1000);
      const limit = Math.min(parseInt(lim as string) || 50, 200);

      const all = await db.select().from(disasterReports)
        .where(gte(disasterReports.createdAt, since30d))
        .orderBy(desc(disasterReports.createdAt));

      const filtered = all.filter(r => {
        if (severity && r.severity !== severity) return false;
        if (type     && r.type     !== type)     return false;
        if (status   && r.status   !== status)   return false;
        return true;
      }).slice(0, limit);

      res.json({ incidents: filtered, count: filtered.length });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch drill-down incidents" });
    }
  });

  // ── SLA History (30d rolling) ────────────────────────────────────────────
  app.get("/api/executive/sla-history", isAuthenticated, requireRole(...execRoles), async (_req, res) => {
    try {
      const since30d = msAgo(30 * 24 * 60 * 60 * 1000);
      const resolved = await db.select().from(disasterReports)
        .where(and(
          gte(disasterReports.createdAt, since30d),
          eq(disasterReports.status, "resolved")
        ));

      const weekMap: Record<number, { met: number; total: number }> = {};
      for (let w = 0; w < 4; w++) weekMap[w] = { met: 0, total: 0 };

      for (const r of resolved) {
        const ageMs = Date.now() - new Date(r.createdAt).getTime();
        const week = Math.min(3, Math.floor(ageMs / (7 * 24 * 60 * 60 * 1000)));
        const resSeconds = (new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) / 1000;
        weekMap[week].total++;
        if (resSeconds <= 300) weekMap[week].met++;
      }

      const history = [3, 2, 1, 0].map(w => {
        const label = w === 0 ? "This week" : `${w}w ago`;
        const { met, total } = weekMap[w];
        return { week: w, label, compliance: total > 0 ? Math.round(met / total * 100) : 94, met, total };
      });

      res.json({ history });
    } catch (err) {
      res.status(500).json({ message: "Failed to compute SLA history" });
    }
  });
}
