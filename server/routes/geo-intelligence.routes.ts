import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { riskMappingService } from "../modules/geo/risk-mapping.service";
import { logger } from "../utils/logger";

export function registerGeoIntelligenceRoutes(app: Express) {
  // Generate risk map for an area
  app.get("/api/geo/risk-map", isAuthenticated, async (req: any, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      const radius = parseFloat(req.query.radius as string) || 100;

      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ message: "lat and lon query params required" });
      }

      const zones = await riskMappingService.generateRiskMap(lat, lon, radius);
      res.json({ zones, generatedAt: new Date().toISOString(), centerLat: lat, centerLon: lon, radiusKm: radius });
    } catch (error) {
      logger.error("Risk map error", error as Error);
      res.status(500).json({ message: "Risk map generation failed" });
    }
  });

  // Optimize route avoiding high-risk zones
  app.post("/api/geo/route", isAuthenticated, async (req: any, res) => {
    try {
      const { fromLat, fromLon, toLat, toLon } = req.body;

      if (!fromLat || !fromLon || !toLat || !toLon) {
        return res.status(400).json({ message: "fromLat, fromLon, toLat, toLon required" });
      }

      const route = await riskMappingService.optimizeRoute(
        parseFloat(fromLat), parseFloat(fromLon),
        parseFloat(toLat), parseFloat(toLon)
      );

      logger.info("Route optimized", {
        userId: req.user.userId,
        riskLevel: route.riskLevel,
        avoidedZones: route.avoidedZones,
      });

      res.json(route);
    } catch (error) {
      logger.error("Route optimization error", error as Error);
      res.status(500).json({ message: "Route optimization failed" });
    }
  });

  // Get safe zones (inverse of high-risk zones)
  app.get("/api/geo/safe-zones", isAuthenticated, async (req: any, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      const radius = parseFloat(req.query.radius as string) || 50;

      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ message: "lat and lon required" });
      }

      const allZones = await riskMappingService.generateRiskMap(lat, lon, radius);
      const safeZones = allZones
        .filter(z => z.riskLevel === "very_low" || z.riskLevel === "low")
        .slice(0, 20);

      res.json({ safeZones, count: safeZones.length });
    } catch (error) {
      logger.error("Safe zones error", error as Error);
      res.status(500).json({ message: "Safe zone lookup failed" });
    }
  });
}
