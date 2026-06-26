import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireAdmin } from "../middleware/roleAuth";
import { storage } from "../db/storage";
import { db } from "../db/db";
import { disasterReports, sosAlerts, analyticsEvents, users } from "@shared/schema";
import { sql, desc, and } from "drizzle-orm";
import { generatePredictions } from "../modules/analytics/prediction.service";
import { riskMappingService } from "../modules/geo/risk-mapping.service";
import { behavioralAnalysisService } from "../modules/trust/behavioral-analysis.service";
import { logger } from "../utils/logger";

export function registerAdvancedAnalyticsRoutes(app: Express) {
  // Predictive analytics - generate predictions for a region
  app.post("/api/analytics/predict", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { lat, lon, area } = req.body;

      if (!lat || !lon) {
        return res.status(400).json({ message: "lat and lon required" });
      }

      const predictions = await generatePredictions({
        area: area || `Area at ${lat},${lon}`,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
      }, process.env.OPENWEATHER_API_KEY);

      res.json({ predictions, generatedAt: new Date().toISOString() });
    } catch (error) {
      logger.error("Predictions error", error as Error);
      res.status(500).json({ message: "Prediction generation failed" });
    }
  });

  // Peak crisis hours analysis (hourly heatmap)
  app.get("/api/analytics/peak-hours", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const reports = await storage.getAllDisasterReports();
      const hourCounts = new Array(24).fill(0);
      const hourSeverity: number[] = new Array(24).fill(0);

      const severityWeights: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

      reports.forEach(r => {
        const hour = new Date(r.createdAt).getHours();
        hourCounts[hour]++;
        hourSeverity[hour] += severityWeights[r.severity] || 1;
      });

      const peakHours = hourCounts.map((count, hour) => ({
        hour,
        label: `${hour.toString().padStart(2, "0")}:00`,
        incidentCount: count,
        severityScore: hourSeverity[hour],
        riskMultiplier: count > 0 ? hourSeverity[hour] / count : 1,
      }));

      const maxCount = Math.max(...hourCounts, 1);
      const peakHour = hourCounts.indexOf(maxCount);

      res.json({
        peakHours,
        peakHour,
        peakHourLabel: `${peakHour.toString().padStart(2, "0")}:00`,
        totalIncidents: reports.length,
        analysisNote: "Based on all historical incident data",
      });
    } catch (error) {
      logger.error("Peak hours analysis error", error as Error);
      res.status(500).json({ message: "Peak hours analysis failed" });
    }
  });

  // Response time SLA compliance
  app.get("/api/analytics/sla-compliance", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const allSOS = await storage.getAllSOSAlerts();

      const resolved = allSOS.filter(s => s.respondedAt);
      const totalAlerts = allSOS.length;

      let totalResponseMs = 0;
      let under30s = 0;
      let under60s = 0;
      let under120s = 0;
      let over120s = 0;

      resolved.forEach(s => {
        const responseMs = new Date(s.respondedAt!).getTime() - new Date(s.createdAt).getTime();
        totalResponseMs += responseMs;
        const secs = responseMs / 1000;
        if (secs <= 30) under30s++;
        else if (secs <= 60) under60s++;
        else if (secs <= 120) under120s++;
        else over120s++;
      });

      const avgResponseSec = resolved.length > 0 ? totalResponseMs / resolved.length / 1000 : 0;

      res.json({
        totalAlerts,
        resolvedAlerts: resolved.length,
        unresolved: totalAlerts - resolved.length,
        avgResponseSeconds: Math.round(avgResponseSec),
        slaBreakdown: {
          under30s,
          under60s,
          under120s,
          over120s,
        },
        slaComplianceRate: resolved.length > 0
          ? Math.round(((under30s + under60s + under120s) / resolved.length) * 100)
          : 0,
      });
    } catch (error) {
      logger.error("SLA compliance error", error as Error);
      res.status(500).json({ message: "SLA compliance analysis failed" });
    }
  });

  // Resource utilization efficiency
  app.get("/api/analytics/resource-efficiency", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [requests, offers, inventory] = await Promise.all([
        storage.getAllResourceRequests(),
        storage.getAllAidOffers(),
        storage.getAllInventoryItems(),
      ]);

      const totalRequests = requests.length;
      const fulfilled = requests.filter(r => r.status === "fulfilled").length;
      const pending = requests.filter(r => r.status === "pending").length;
      const matched = offers.filter(o => o.matchedRequestId).length;

      const fulfillmentRate = totalRequests > 0 ? (fulfilled / totalRequests) * 100 : 0;
      const matchRate = offers.length > 0 ? (matched / offers.length) * 100 : 0;

      const lowStock = inventory.filter(i =>
        i.minimumThreshold && i.quantity <= i.minimumThreshold
      );

      res.json({
        resourceRequests: {
          total: totalRequests,
          fulfilled,
          pending,
          fulfillmentRate: Math.round(fulfillmentRate),
        },
        aidOffers: {
          total: offers.length,
          matched,
          matchRate: Math.round(matchRate),
        },
        inventory: {
          totalItems: inventory.length,
          lowStockItems: lowStock.length,
          criticalItems: lowStock.filter(i => i.quantity === 0).length,
        },
        overallEfficiencyScore: Math.round((fulfillmentRate + matchRate) / 2),
      });
    } catch (error) {
      logger.error("Resource efficiency error", error as Error);
      res.status(500).json({ message: "Resource efficiency analysis failed" });
    }
  });

  // Seasonal patterns analysis
  app.get("/api/analytics/seasonal-patterns", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const reports = await storage.getAllDisasterReports();

      const monthlyData: Record<number, { count: number; types: Record<string, number>; severity: Record<string, number> }> = {};

      for (let m = 0; m < 12; m++) {
        monthlyData[m] = { count: 0, types: {}, severity: {} };
      }

      reports.forEach(r => {
        const month = new Date(r.createdAt).getMonth();
        monthlyData[month].count++;
        monthlyData[month].types[r.type] = (monthlyData[month].types[r.type] || 0) + 1;
        monthlyData[month].severity[r.severity] = (monthlyData[month].severity[r.severity] || 0) + 1;
      });

      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

      const seasonal = Object.entries(monthlyData).map(([month, data]) => ({
        month: parseInt(month),
        monthName: monthNames[parseInt(month)],
        incidentCount: data.count,
        topDisasterType: Object.entries(data.types).sort((a, b) => b[1] - a[1])[0]?.[0] || "none",
        severityBreakdown: data.severity,
        typeBreakdown: data.types,
      }));

      const peakMonth = seasonal.reduce((a, b) => a.incidentCount > b.incidentCount ? a : b);

      res.json({
        seasonal,
        peakMonth: peakMonth.monthName,
        peakMonthIncidents: peakMonth.incidentCount,
        dataPoints: reports.length,
      });
    } catch (error) {
      logger.error("Seasonal patterns error", error as Error);
      res.status(500).json({ message: "Seasonal analysis failed" });
    }
  });

  // §8 Analytics — Incident conversion funnel
  app.get("/api/analytics/funnel", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [reports, sos, resourceRequests] = await Promise.all([
        storage.getAllDisasterReports(),
        storage.getAllSOSAlerts(),
        storage.getAllResourceRequests(),
      ]);

      const submitted = reports.length;
      const verified = reports.filter(r => r.verificationCount && r.verificationCount >= 1).length;
      const withResources = reports.filter(r =>
        resourceRequests.some(rq => rq.disasterReportId === r.id)
      ).length;
      const dispatched = reports.filter(r => r.assignedTo).length;
      const resolved = reports.filter(r => r.status === "resolved").length;

      const funnel = [
        { stage: "Submitted", count: submitted, pct: 100, color: "#6366f1" },
        { stage: "Verified", count: verified, pct: submitted > 0 ? Math.round((verified / submitted) * 100) : 0, color: "#10b981" },
        { stage: "Resources Requested", count: withResources, pct: submitted > 0 ? Math.round((withResources / submitted) * 100) : 0, color: "#f59e0b" },
        { stage: "Dispatched", count: dispatched, pct: submitted > 0 ? Math.round((dispatched / submitted) * 100) : 0, color: "#f97316" },
        { stage: "Resolved", count: resolved, pct: submitted > 0 ? Math.round((resolved / submitted) * 100) : 0, color: "#22c55e" },
      ];

      const activeSOS = sos.filter(s => s.status === "active").length;
      const resolvedSOS = sos.filter(s => s.status === "resolved").length;

      res.json({
        funnel,
        sosFunnel: [
          { stage: "Activated", count: sos.length, pct: 100, color: "#ef4444" },
          { stage: "Responding", count: sos.filter(s => s.status === "responding").length, pct: sos.length > 0 ? Math.round((sos.filter(s => s.status === "responding").length / sos.length) * 100) : 0, color: "#f97316" },
          { stage: "Resolved", count: resolvedSOS, pct: sos.length > 0 ? Math.round((resolvedSOS / sos.length) * 100) : 0, color: "#22c55e" },
        ],
        overallConversionRate: submitted > 0 ? Math.round((resolved / submitted) * 100) : 0,
      });
    } catch (error) {
      logger.error("Funnel analytics error", error as Error);
      res.status(500).json({ message: "Funnel analysis failed" });
    }
  });

  // §8 Analytics — User cohort analysis
  app.get("/api/analytics/cohort", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [users, reports] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllDisasterReports(),
      ]);

      const now = Date.now();
      const MS_DAY = 86400000;

      const cohorts = {
        new: users.filter(u => now - new Date(u.createdAt).getTime() < 7 * MS_DAY).length,
        week: users.filter(u => {
          const age = now - new Date(u.createdAt).getTime();
          return age >= 7 * MS_DAY && age < 30 * MS_DAY;
        }).length,
        month: users.filter(u => {
          const age = now - new Date(u.createdAt).getTime();
          return age >= 30 * MS_DAY && age < 90 * MS_DAY;
        }).length,
        established: users.filter(u => now - new Date(u.createdAt).getTime() >= 90 * MS_DAY).length,
      };

      const roleBreakdown = users.reduce<Record<string, number>>((acc, u) => {
        const role = u.role ?? "unknown";
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {});

      const activeReporters = new Set(reports.map(r => r.userId)).size;
      const multiReporters = Object.entries(
        reports.reduce<Record<string, number>>((acc, r) => {
          if (r.userId) acc[r.userId] = (acc[r.userId] || 0) + 1;
          return acc;
        }, {})
      ).filter(([, count]) => count >= 3).length;

      const reportsByRole = Object.entries(roleBreakdown).map(([role, count]) => ({
        role,
        users: count,
        avgReports: reports.filter(r => {
          const user = users.find(u => u.id === r.userId);
          return user?.role === role;
        }).length / Math.max(count, 1),
      }));

      res.json({
        userCohorts: [
          { label: "New (< 7d)", count: cohorts.new, color: "#6366f1" },
          { label: "Recent (7-30d)", count: cohorts.week, color: "#10b981" },
          { label: "Regular (30-90d)", count: cohorts.month, color: "#f59e0b" },
          { label: "Established (90d+)", count: cohorts.established, color: "#ec4899" },
        ],
        roleBreakdown: Object.entries(roleBreakdown).map(([role, count]) => ({ role, count })),
        engagement: {
          totalUsers: users.length,
          activeReporters,
          multiReporters,
          engagementRate: users.length > 0 ? Math.round((activeReporters / users.length) * 100) : 0,
        },
        reportsByRole,
      });
    } catch (error) {
      logger.error("Cohort analytics error", error as Error);
      res.status(500).json({ message: "Cohort analysis failed" });
    }
  });

  // System health overview
  app.get("/api/analytics/system-health", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [reports, sos, userList, anomalies] = await Promise.all([
        storage.getAllDisasterReports(),
        storage.getAllSOSAlerts(),
        storage.getAllUsers(),
        behavioralAnalysisService.detectSystemAnomalies(),
      ]);

      const activeReports = reports.filter(r => r.status !== "resolved").length;
      const activeSOS = sos.filter(s => s.status === "active" || s.status === "responding").length;
      const criticalReports = reports.filter(r => r.severity === "critical" && r.status !== "resolved").length;

      res.json({
        systemStatus: criticalReports > 5 || activeSOS > 3 ? "critical" :
          criticalReports > 2 || activeSOS > 1 ? "warning" : "normal",
        activeReports,
        activeSOS,
        criticalReports,
        totalUsers: userList.length,
        anomaliesDetected: anomalies.length,
        anomalies,
        uptime: process.uptime(),
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("System health error", error as Error);
      res.status(500).json({ message: "System health check failed" });
    }
  });
}
