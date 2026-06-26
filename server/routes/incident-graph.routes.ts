import type { Express } from "express";
import { authenticateToken } from "../middleware/jwtAuth";
import { incidentGraphService } from "../modules/graph/incident-graph.service";
import { logger } from "../utils/logger";

export function registerIncidentGraphRoutes(app: Express) {
  app.get("/api/incidents/:reportId/graph", authenticateToken, async (req, res) => {
    try {
      const { reportId } = req.params;
      const graph = await incidentGraphService.buildGraph(reportId);
      res.json(graph);
    } catch (error) {
      logger.error("Failed to build incident graph", error as Error);
      res.status(500).json({ message: "Failed to build incident graph" });
    }
  });
}
