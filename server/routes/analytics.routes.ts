import type { Express } from "express";
import { storage } from "../db/storage";
import { isAuthenticated } from "../auth/replitAuth";

export function registerAnalyticsRoutes(app: Express) {
  // Get analytics events (Admin only)
  app.get("/api/analytics/events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 1000;
      const events = await storage.getAnalyticsEvents(limit);
      res.json(events);
    } catch (error) {
      console.error("Error fetching analytics events:", error);
      res.status(500).json({ message: "Failed to fetch analytics events" });
    }
  });

  // Get analytics summary (Admin only)
  app.get("/api/analytics/summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const events = await storage.getAnalyticsEventsByDateRange(thirtyDaysAgo, now);

      const summary = {
        totalEvents: events.length,
        reportSubmitted: events.filter(e => e.eventType === "report_submitted").length,
        reportVerified: events.filter(e => e.eventType === "report_verified").length,
        reportResolved: events.filter(e => e.eventType === "report_resolved").length,
        resourceRequested: events.filter(e => e.eventType === "resource_requested").length,
        resourceFulfilled: events.filter(e => e.eventType === "resource_fulfilled").length,
        aidOffered: events.filter(e => e.eventType === "aid_offered").length,
        aidDelivered: events.filter(e => e.eventType === "aid_delivered").length,
        avgResponseTime: events
          .filter(e => e.responseTime)
          .reduce((sum, e) => sum + (e.responseTime || 0), 0) / 
          events.filter(e => e.responseTime).length || 0,
      };

      res.json(summary);
    } catch (error) {
      console.error("Error fetching analytics summary:", error);
      res.status(500).json({ message: "Failed to fetch analytics summary" });
    }
  });

  // Get disaster frequency data (Admin only)
  app.get("/api/analytics/disaster-frequency", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const reports = await storage.getAllDisasterReports();
      
      const frequency: Record<string, number> = {};
      reports.forEach(report => {
        const type = report.type;
        frequency[type] = (frequency[type] || 0) + 1;
      });

      res.json(frequency);
    } catch (error) {
      console.error("Error fetching disaster frequency:", error);
      res.status(500).json({ message: "Failed to fetch disaster frequency" });
    }
  });

  // Get geographic impact data (Admin only)
  app.get("/api/analytics/geographic-impact", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const reports = await storage.getAllDisasterReports();
      
      const geographicData = reports
        .filter(r => r.latitude && r.longitude)
        .map(r => ({
          id: r.id,
          type: r.type,
          severity: r.severity,
          location: r.location,
          latitude: parseFloat(r.latitude || "0"),
          longitude: parseFloat(r.longitude || "0"),
          status: r.status,
        }));

      res.json(geographicData);
    } catch (error) {
      console.error("Error fetching geographic impact:", error);
      res.status(500).json({ message: "Failed to fetch geographic impact" });
    }
  });
}
