import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { generateAllPredictions, getLivePredictions, getPredictionStats } from "../modules/predictions/predictive-response.service";
import { logger } from "../utils/logger";

export function registerPredictionRoutes(app: Express) {
  app.get("/api/predictions/live", isAuthenticated, async (_req, res) => {
    try {
      const predictions = await getLivePredictions();
      res.json({ predictions, count: predictions.length, generatedAt: new Date().toISOString() });
    } catch (err) {
      logger.error("Failed to fetch live predictions", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Failed to fetch predictions" });
    }
  });

  app.get("/api/predictions/stats", isAuthenticated, async (_req, res) => {
    try {
      const stats = await getPredictionStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch prediction stats" });
    }
  });

  app.post(
    "/api/predictions/generate-all",
    isAuthenticated,
    requireRole("admin", "authority", "super_admin"),
    async (_req, res) => {
      try {
        logger.info("[PredictionRoutes] Manual prediction generation triggered");
        const predictions = await generateAllPredictions();
        res.status(201).json({
          message: "Predictions generated successfully",
          predictions,
          count: predictions.length,
          generatedAt: new Date().toISOString(),
        });
      } catch (err) {
        logger.error("Prediction generation failed", err instanceof Error ? err : undefined);
        res.status(500).json({ message: "Prediction generation failed" });
      }
    }
  );
}
