import type { Express } from "express";
import { storage } from "../db/storage";
import { clusteringService } from "../utils/clustering";
import { isAuthenticated } from "../auth/replitAuth";

export function registerClusteringRoutes(app: Express) {
  app.get("/api/reports/clusters", isAuthenticated, async (req, res) => {
    try {
      const reports = await storage.getReportsWithClusters();
      const clusters = clusteringService.clusterReports(reports);
      
      res.json({
        clusters: clusters.map(cluster => ({
          clusterId: cluster.clusterId,
          primaryReport: cluster.primaryReport,
          relatedReports: cluster.reports.filter(r => r.id !== cluster.primaryReport.id),
          totalReports: cluster.reports.length,
          confidence: cluster.confidence,
          reasons: cluster.reasons,
        })),
        totalClusters: clusters.length,
        totalReportsInClusters: clusters.reduce((sum, c) => sum + c.reports.length, 0),
      });
    } catch (error: any) {
      console.error("Error getting report clusters:", error);
      res.status(500).json({ message: "Failed to get report clusters" });
    }
  });

  app.get("/api/reports/:id/similar", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.getDisasterReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      const allReports = await storage.getAllDisasterReports();
      const similar = clusteringService.findSimilarReports(report, allReports);
      
      const similarReports = await Promise.all(
        similar.map(async (sim) => {
          const r = await storage.getDisasterReport(sim.reportId);
          return {
            report: r,
            similarity: sim.score,
            reasons: sim.reasons,
          };
        })
      );

      res.json({
        targetReport: report,
        similarReports: similarReports.filter(r => r.report),
        count: similarReports.length,
      });
    } catch (error: any) {
      console.error("Error finding similar reports:", error);
      res.status(500).json({ message: "Failed to find similar reports" });
    }
  });

  app.post("/api/reports/:id/detect-duplicates", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.getDisasterReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      const allReports = await storage.getAllDisasterReports();
      const existingReports = allReports.filter(r => r.id !== id);
      
      const duplicateCheck = clusteringService.detectDuplicates(report, existingReports);

      if (duplicateCheck.isDuplicate && duplicateCheck.duplicateOf) {
        const duplicateReport = await storage.getDisasterReport(duplicateCheck.duplicateOf);
        
        res.json({
          isDuplicate: true,
          duplicateOf: duplicateReport,
          confidence: duplicateCheck.confidence,
          reasons: duplicateCheck.reasons,
        });
      } else {
        res.json({
          isDuplicate: false,
          confidence: duplicateCheck.confidence,
          reasons: duplicateCheck.reasons,
        });
      }
    } catch (error: any) {
      console.error("Error detecting duplicates:", error);
      res.status(500).json({ message: "Failed to detect duplicates" });
    }
  });

  app.post("/api/reports/:id/link-similar", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { similarReportIds } = req.body;

      if (!Array.isArray(similarReportIds)) {
        return res.status(400).json({ message: "similarReportIds must be an array" });
      }

      const updatedReport = await storage.updateSimilarReports(id, similarReportIds);

      if (!updatedReport) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.json(updatedReport);
    } catch (error: any) {
      console.error("Error linking similar reports:", error);
      res.status(500).json({ message: "Failed to link similar reports" });
    }
  });

  app.post("/api/reports/run-clustering", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.claims?.sub;
      const userRole = (await storage.getUser(userId))?.role;

      if (userRole !== "admin" && userRole !== "ngo") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const reports = await storage.getRecentReports(limit);
      
      const clusters = clusteringService.clusterReports(reports);
      
      let updatedCount = 0;
      for (const cluster of clusters) {
        if (cluster.reports.length > 1) {
          const reportIds = cluster.reports.map(r => r.id);
          
          for (const report of cluster.reports) {
            const similarIds = reportIds.filter(rid => rid !== report.id);
            await storage.updateSimilarReports(report.id, similarIds);
            updatedCount++;
          }
        }
      }

      res.json({
        message: "Clustering completed successfully",
        clustersFound: clusters.length,
        reportsAnalyzed: reports.length,
        reportsUpdated: updatedCount,
        clusters: clusters.map(c => ({
          clusterId: c.clusterId,
          reportCount: c.reports.length,
          confidence: c.confidence,
        })),
      });
    } catch (error: any) {
      console.error("Error running clustering:", error);
      res.status(500).json({ message: "Failed to run clustering" });
    }
  });
}
