import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireAdmin } from "../middleware/roleAuth";
import { behavioralAnalysisService } from "../modules/trust/behavioral-analysis.service";
import { logger } from "../utils/logger";
import { storage } from "../db/storage";

export function registerTrustRoutes(app: Express) {
  // Get behavioral profile for a user
  app.get("/api/trust/user/:userId/profile", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const requestingUser = req.user;

      // Users can see their own profile; admins see all
      if (requestingUser.userId !== userId && requestingUser.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const profile = await behavioralAnalysisService.analyzeUser(userId);
      res.json(profile);
    } catch (error) {
      logger.error("Trust profile error", error as Error);
      res.status(500).json({ message: "Failed to fetch trust profile" });
    }
  });

  // Get trust score summary
  app.get("/api/trust/user/:userId/score", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const profile = await behavioralAnalysisService.analyzeUser(userId);
      const reputation = await storage.getUserReputation(userId);

      res.json({
        userId,
        trustScore: reputation?.trustScore || 50,
        trustBadge: profile.trustBadge,
        riskLevel: profile.riskLevel,
        anomalyScore: profile.anomalyScore,
        anomalyFlags: profile.anomalyFlags,
      });
    } catch (error) {
      logger.error("Trust score error", error as Error);
      res.status(500).json({ message: "Failed to fetch trust score" });
    }
  });

  // Detect system-wide anomalies (admin only)
  app.get("/api/trust/anomalies", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const anomalies = await behavioralAnalysisService.detectSystemAnomalies();
      res.json({ anomalies, checkedAt: new Date().toISOString() });
    } catch (error) {
      logger.error("Anomaly detection error", error as Error);
      res.status(500).json({ message: "Anomaly detection failed" });
    }
  });

  // Get all users with high risk profiles (admin only)
  app.get("/api/trust/high-risk-users", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const profiles = await Promise.all(
        allUsers.slice(0, 50).map(u => behavioralAnalysisService.analyzeUser(u.id))
      );

      const highRisk = profiles
        .filter(p => p.riskLevel === "high" || p.riskLevel === "critical")
        .sort((a, b) => b.anomalyScore - a.anomalyScore);

      res.json({ highRiskUsers: highRisk, total: highRisk.length });
    } catch (error) {
      logger.error("High risk users error", error as Error);
      res.status(500).json({ message: "Failed to fetch high risk users" });
    }
  });
}
