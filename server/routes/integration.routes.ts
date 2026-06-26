import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { reverseGeocode, calculateDistance, getCacheStats } from "../modules/integration/maps.service";
import { fetchWeather, getLatestWeather, getAllRegionWeather, getWeatherDescription } from "../modules/integration/weather.service";
import { findNearbyHospitals } from "../modules/integration/hospitals.service";
import { circuitBreakers } from "../modules/resilience/circuit-breaker";
import { logger } from "../utils/logger";

export function registerIntegrationRoutes(app: Express) {
  // ── Maps ──────────────────────────────────────────────────────────────────
  app.get("/api/integration/maps/reverse-geocode", isAuthenticated, async (req: any, res) => {
    try {
      const { lat, lng } = req.query as Record<string, string>;
      if (!lat || !lng) return res.status(400).json({ message: "lat and lng are required" });
      const result = await reverseGeocode(lat, lng);
      res.json(result);
    } catch (err) {
      logger.error("Reverse geocode failed", err instanceof Error ? err : undefined);
      res.status(502).json({ message: "Geocoding service unavailable", error: (err as Error).message });
    }
  });

  app.get("/api/integration/maps/distance", isAuthenticated, async (req: any, res) => {
    try {
      const { lat1, lng1, lat2, lng2 } = req.query as Record<string, string>;
      if (!lat1 || !lng1 || !lat2 || !lng2) return res.status(400).json({ message: "lat1, lng1, lat2, lng2 required" });
      const result = await calculateDistance(parseFloat(lat1), parseFloat(lng1), parseFloat(lat2), parseFloat(lng2));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Distance calculation failed" });
    }
  });

  app.get("/api/integration/maps/cache", isAuthenticated, async (req: any, res) => {
    res.json(getCacheStats());
  });

  // ── Weather ───────────────────────────────────────────────────────────────
  app.get("/api/integration/weather", isAuthenticated, async (req: any, res) => {
    try {
      const { lat, lng, region } = req.query as Record<string, string>;
      if (!lat || !lng) return res.status(400).json({ message: "lat and lng are required" });
      const data = await fetchWeather(lat, lng, region || "Unknown");
      const desc = getWeatherDescription(data.weatherCode || 0);
      res.json({ ...data, weatherDescription: desc.description });
    } catch (err) {
      logger.error("Weather fetch failed", err instanceof Error ? err : undefined);
      res.status(502).json({ message: "Weather service unavailable" });
    }
  });

  app.get("/api/integration/weather/latest", isAuthenticated, async (req: any, res) => {
    try {
      const { region } = req.query as Record<string, string>;
      if (!region) return res.status(400).json({ message: "region is required" });
      const data = await getLatestWeather(region);
      if (!data) return res.status(404).json({ message: "No weather data for this region" });
      res.json({ ...data, weatherDescription: getWeatherDescription(data.weatherCode || 0).description });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/integration/weather/regions", isAuthenticated, async (req: any, res) => {
    try {
      const rows = await getAllRegionWeather();
      res.json({ regions: rows.map(r => ({ ...r, weatherDescription: getWeatherDescription(r.weatherCode || 0).description })) });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Hospitals ─────────────────────────────────────────────────────────────
  app.get("/api/integration/hospitals/nearby", isAuthenticated, async (req: any, res) => {
    try {
      const { lat, lng, radius } = req.query as Record<string, string>;
      if (!lat || !lng) return res.status(400).json({ message: "lat and lng are required" });
      const hospitals = await findNearbyHospitals(lat, lng, radius ? parseFloat(radius) : 15);
      res.json({ hospitals, count: hospitals.length, searchCenter: { lat, lng }, radiusKm: radius || 15 });
    } catch (err) {
      logger.error("Hospital search failed", err instanceof Error ? err : undefined);
      res.status(502).json({ message: "Hospital service unavailable" });
    }
  });

  // ── Circuit Breaker Status ─────────────────────────────────────────────────
  app.get("/api/integration/status", isAuthenticated, async (req: any, res) => {
    const statuses = Object.values(circuitBreakers).map(cb => cb.getStatus());
    res.json({ integrations: statuses, timestamp: new Date().toISOString() });
  });
}
