import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { responderRanking } from "../modules/responders/responder-ranking.service";
import { logger } from "../utils/logger";

export function registerResponderRoutes(app: Express) {
  // Rank responders for a specific report
  app.get("/api/responders/ranked/:reportId", isAuthenticated,
    requireRole("admin", "authority", "super_admin"),
    async (req, res) => {
      try {
        const maxResults = Math.min(parseInt(req.query.limit as string) || 5, 20);
        const result = await responderRanking.rankForReport(req.params.reportId, maxResults);
        if (!result) return res.status(404).json({ message: "Report not found" });
        res.json(result);
      } catch (err) {
        logger.error("Responder ranking failed", err instanceof Error ? err : undefined);
        res.status(500).json({ message: "Ranking failed" });
      }
    }
  );

  // Rank responders for an ad-hoc incident (emergency type + coords)
  app.post("/api/responders/rank", isAuthenticated,
    requireRole("admin", "authority", "super_admin"),
    async (req, res) => {
      try {
        const { emergencyType, latitude, longitude, severity, maxResults } = req.body;
        if (!emergencyType || latitude === undefined || longitude === undefined) {
          return res.status(400).json({ message: "emergencyType, latitude, and longitude are required" });
        }
        const result = await responderRanking.rankForIncident(
          `adhoc-${Date.now()}`,
          emergencyType,
          parseFloat(latitude),
          parseFloat(longitude),
          severity,
          Math.min(maxResults ?? 5, 20)
        );
        res.json(result);
      } catch (err) {
        logger.error("Ad-hoc ranking failed", err instanceof Error ? err : undefined);
        res.status(500).json({ message: "Ranking failed" });
      }
    }
  );
}
