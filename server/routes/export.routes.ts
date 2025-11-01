import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { storage } from "../db/storage";
import { StreamExporter } from "../utils/streamExport";
import { logger } from "../utils/logger";

export function registerExportRoutes(app: Express) {
  /**
   * Export disaster reports to CSV
   * @route GET /api/exports/reports/csv
   * @access Authenticated users
   */
  app.get("/api/exports/reports/csv", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);

      // Only allow admins and NGOs to export all reports
      if (!user || !["admin", "ngo"].includes(user.role as string)) {
        return res.status(403).json({
          message: "Only admins and NGOs can export disaster reports",
        });
      }

      logger.info("Starting CSV export", { userId, type: "disaster_reports" });

      const filename = `disaster-reports-${new Date().toISOString().split('T')[0]}.csv`;
      const headers = [
        "id",
        "title",
        "description",
        "type",
        "severity",
        "status",
        "location",
        "latitude",
        "longitude",
        "userId",
        "verificationCount",
        "createdAt",
      ];

      await StreamExporter.exportToCSV(
        res,
        async (offset, limit) => {
          const { reports, total } = await storage.getPaginatedDisasterReports(limit, offset);
          return {
            data: reports,
            hasMore: offset + limit < total,
          };
        },
        { filename, headers, batchSize: 500 }
      );
    } catch (error) {
      logger.error("Error exporting reports to CSV", error as Error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to export reports" });
      }
    }
  });

  /**
   * Export disaster reports to JSON
   * @route GET /api/exports/reports/json
   * @access Authenticated users
   */
  app.get("/api/exports/reports/json", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);

      if (!user || !["admin", "ngo"].includes(user.role as string)) {
        return res.status(403).json({
          message: "Only admins and NGOs can export disaster reports",
        });
      }

      logger.info("Starting JSON export", { userId, type: "disaster_reports" });

      const filename = `disaster-reports-${new Date().toISOString().split('T')[0]}.json`;

      await StreamExporter.exportToJSON(
        res,
        async (offset, limit) => {
          const { reports, total } = await storage.getPaginatedDisasterReports(limit, offset);
          return {
            data: reports,
            hasMore: offset + limit < total,
          };
        },
        filename,
        500
      );
    } catch (error) {
      logger.error("Error exporting reports to JSON", error as Error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to export reports" });
      }
    }
  });

  /**
   * Export resource requests to CSV
   * @route GET /api/exports/resources/csv
   * @access Authenticated users
   */
  app.get("/api/exports/resources/csv", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);

      if (!user || !["admin", "ngo"].includes(user.role as string)) {
        return res.status(403).json({
          message: "Only admins and NGOs can export resource requests",
        });
      }

      logger.info("Starting CSV export", { userId, type: "resource_requests" });

      const filename = `resource-requests-${new Date().toISOString().split('T')[0]}.csv`;
      const headers = [
        "id",
        "resourceType",
        "quantity",
        "urgency",
        "status",
        "description",
        "location",
        "userId",
        "createdAt",
      ];

      await StreamExporter.exportToCSV(
        res,
        async (offset, limit) => {
          const { requests, total } = await storage.getPaginatedResourceRequests(limit, offset);
          return {
            data: requests,
            hasMore: offset + limit < total,
          };
        },
        { filename, headers, batchSize: 500 }
      );
    } catch (error) {
      logger.error("Error exporting resources to CSV", error as Error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to export resource requests" });
      }
    }
  });
}
