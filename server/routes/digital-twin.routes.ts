import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { simulateCrisisPropagation, seedDefaultCityModel } from "../modules/digital-twin/digital-twin.service";
import { db } from "../db/db";
import { cityNodes, cityEdges } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../utils/logger";

export function registerDigitalTwinRoutes(app: Express) {
  // Seed default city model
  app.post("/api/digital-twin/seed", isAuthenticated, requireRole("admin", "authority", "super_admin"), async (req: any, res) => {
    try {
      const { cityId = "default" } = req.body;
      const result = await seedDefaultCityModel(cityId);
      res.json(result);
    } catch (err) {
      logger.error("Digital twin seed failed", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Seed failed", error: (err as Error).message });
    }
  });

  // Get city model (nodes + edges)
  app.get("/api/digital-twin/model", isAuthenticated, async (req: any, res) => {
    try {
      const cityId = (req.query.cityId as string) || "default";
      const [nodes, edges] = await Promise.all([
        db.select().from(cityNodes).where(eq(cityNodes.cityId, cityId)),
        db.select().from(cityEdges).where(eq(cityEdges.cityId, cityId)),
      ]);
      res.json({ cityId, nodes, edges, nodeCount: nodes.length, edgeCount: edges.length });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Simulate crisis propagation
  app.post("/api/digital-twin/simulate", isAuthenticated, async (req: any, res) => {
    try {
      const { crisisNodeId, crisisType = "flood", severity = "high", cityId = "default" } = req.body;
      if (!crisisNodeId) return res.status(400).json({ message: "crisisNodeId is required" });

      const result = await simulateCrisisPropagation({ crisisNodeId, crisisType, severity }, cityId);
      res.json(result);
    } catch (err) {
      logger.error("Digital twin simulation failed", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Simulation failed", error: (err as Error).message });
    }
  });

  // Update node risk score
  app.patch("/api/digital-twin/nodes/:id/risk", isAuthenticated, requireRole("admin", "authority", "super_admin"), async (req: any, res) => {
    try {
      const { riskScore } = req.body;
      if (riskScore === undefined || riskScore < 0 || riskScore > 100) {
        return res.status(400).json({ message: "riskScore must be 0–100" });
      }
      await db.update(cityNodes).set({ riskScore }).where(eq(cityNodes.id, req.params.id));
      res.json({ message: "Risk score updated" });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Quick simulation using lat/lng (finds nearest node automatically)
  app.post("/api/digital-twin/simulate-location", isAuthenticated, async (req: any, res) => {
    try {
      const { latitude, longitude, crisisType = "flood", severity = "high", cityId = "default" } = req.body;
      if (!latitude || !longitude) return res.status(400).json({ message: "latitude and longitude are required" });

      const nodes = await db.select().from(cityNodes).where(eq(cityNodes.cityId, cityId));
      if (nodes.length === 0) return res.status(404).json({ message: "No city model found. POST /api/digital-twin/seed first." });

      // Find nearest node to the given coordinates
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const nearest = nodes.reduce((best, n) => {
        const d = Math.hypot(parseFloat(n.latitude) - lat, parseFloat(n.longitude) - lng);
        const bd = Math.hypot(parseFloat(best.latitude) - lat, parseFloat(best.longitude) - lng);
        return d < bd ? n : best;
      });

      const result = await simulateCrisisPropagation({ crisisNodeId: nearest.id, crisisType, severity }, cityId);
      res.json({ ...result, originNode: { id: nearest.id, name: nearest.name, type: nearest.type } });
    } catch (err) {
      logger.error("Digital twin location sim failed", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Simulation failed" });
    }
  });
}
