import { db } from "../../db/db";
import { disasterReports } from "@shared/schema";
import { logger } from "../../utils/logger";

export interface RiskZone {
  latitude: number;
  longitude: number;
  radius: number;
  riskScore: number;
  riskLevel: "very_low" | "low" | "moderate" | "high" | "very_high";
  disasterTypes: string[];
  incidentCount: number;
  lastIncident?: string;
  factors: string[];
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  label?: string;
}

export interface SafeRoute {
  waypoints: RoutePoint[];
  distanceKm: number;
  estimatedMinutes: number;
  riskLevel: "safe" | "moderate" | "avoid";
  avoidedZones: number;
  notes: string[];
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function riskLevelFromScore(score: number): RiskZone["riskLevel"] {
  if (score >= 80) return "very_high";
  if (score >= 60) return "high";
  if (score >= 40) return "moderate";
  if (score >= 20) return "low";
  return "very_low";
}

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 40,
  high: 25,
  medium: 15,
  low: 5,
};

const TIME_DECAY_HOURS = 72;

export class RiskMappingService {
  async generateRiskMap(
    centerLat: number,
    centerLon: number,
    radiusKm: number = 100
  ): Promise<RiskZone[]> {
    try {
      const reports = await db.select().from(disasterReports);
      const now = Date.now();

      const cellSize = 0.1;
      const grid = new Map<string, {
        lat: number; lon: number; score: number;
        types: Set<string>; count: number; lastIncident?: Date; factors: string[];
      }>();

      for (const report of reports) {
        if (!report.latitude || !report.longitude) continue;
        const lat = parseFloat(report.latitude);
        const lon = parseFloat(report.longitude);

        if (haversineDistance(centerLat, centerLon, lat, lon) > radiusKm) continue;

        const cellLat = Math.round(lat / cellSize) * cellSize;
        const cellLon = Math.round(lon / cellSize) * cellSize;
        const key = `${cellLat.toFixed(1)},${cellLon.toFixed(1)}`;

        const hoursAgo = (now - new Date(report.createdAt).getTime()) / 3_600_000;
        const decayFactor = Math.max(0.1, 1 - hoursAgo / (TIME_DECAY_HOURS * 30));
        const severityWeight = SEVERITY_WEIGHTS[report.severity] || 10;

        const existing = grid.get(key) || {
          lat: cellLat, lon: cellLon, score: 0,
          types: new Set<string>(), count: 0, factors: [],
        };

        existing.score += severityWeight * decayFactor;
        existing.types.add(report.type);
        existing.count++;

        if (!existing.lastIncident || new Date(report.createdAt) > existing.lastIncident) {
          existing.lastIncident = new Date(report.createdAt);
        }

        const hour = new Date(report.createdAt).getHours();
        if (hour >= 22 || hour <= 5) {
          existing.score += 5;
          existing.factors.push("nighttime_incident");
        }

        if (existing.count >= 3) existing.factors.push("high_density_area");
        if (report.severity === "critical") existing.factors.push("critical_severity");

        grid.set(key, existing);
      }

      const zones: RiskZone[] = [];
      for (const [, cell] of grid) {
        const normalizedScore = Math.min(100, cell.score);
        zones.push({
          latitude: cell.lat,
          longitude: cell.lon,
          radius: cellSize * 111_000,
          riskScore: Math.round(normalizedScore),
          riskLevel: riskLevelFromScore(normalizedScore),
          disasterTypes: Array.from(cell.types),
          incidentCount: cell.count,
          lastIncident: cell.lastIncident?.toISOString(),
          factors: [...new Set(cell.factors)],
        });
      }

      zones.sort((a, b) => b.riskScore - a.riskScore);
      logger.info("Risk map generated", { zones: zones.length, centerLat, centerLon });
      return zones;
    } catch (error) {
      logger.error("Risk mapping error", error as Error);
      return [];
    }
  }

  async optimizeRoute(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number
  ): Promise<SafeRoute> {
    try {
      const centerLat = (fromLat + toLat) / 2;
      const centerLon = (fromLon + toLon) / 2;
      const totalDist = haversineDistance(fromLat, fromLon, toLat, toLon);
      const riskZones = await this.generateRiskMap(centerLat, centerLon, totalDist + 20);

      const highRiskZones = riskZones.filter(z => z.riskScore >= 60);

      const directRouteRisk = this.checkRouteRisk(
        fromLat, fromLon, toLat, toLon, highRiskZones
      );

      const notes: string[] = [];
      let waypoints: RoutePoint[] = [
        { latitude: fromLat, longitude: fromLon, label: "Start" },
        { latitude: toLat, longitude: toLon, label: "Destination" },
      ];
      let routeRiskLevel: SafeRoute["riskLevel"] = "safe";
      let avoidedZones = 0;

      if (directRouteRisk > 0) {
        const altRoute = this.generateAlternativeRoute(
          fromLat, fromLon, toLat, toLon, highRiskZones
        );
        waypoints = altRoute.waypoints;
        avoidedZones = directRouteRisk;
        routeRiskLevel = altRoute.riskLevel;
        notes.push(`Direct route passes through ${directRouteRisk} high-risk zone(s)`);
        notes.push(`Alternative route generated avoiding high-risk areas`);
        if (altRoute.riskLevel === "moderate") {
          notes.push("Some moderate-risk zones unavoidable on this route");
        }
      } else {
        notes.push("Direct route is safe — no high-risk zones detected");
      }

      const routeDist = this.calculateRouteDistance(waypoints);
      const speed = 40;

      return {
        waypoints,
        distanceKm: Math.round(routeDist * 10) / 10,
        estimatedMinutes: Math.round((routeDist / speed) * 60),
        riskLevel: routeRiskLevel,
        avoidedZones,
        notes,
      };
    } catch (error) {
      logger.error("Route optimization error", error as Error);
      return {
        waypoints: [
          { latitude: fromLat, longitude: fromLon, label: "Start" },
          { latitude: toLat, longitude: toLon, label: "Destination" },
        ],
        distanceKm: haversineDistance(fromLat, fromLon, toLat, toLon),
        estimatedMinutes: 30,
        riskLevel: "moderate",
        avoidedZones: 0,
        notes: ["Route optimization unavailable — using direct route"],
      };
    }
  }

  private checkRouteRisk(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
    riskZones: RiskZone[]
  ): number {
    let count = 0;
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat = lat1 + (lat2 - lat1) * t;
      const lon = lon1 + (lon2 - lon1) * t;
      for (const zone of riskZones) {
        const dist = haversineDistance(lat, lon, zone.latitude, zone.longitude);
        if (dist < zone.radius / 1000) { count++; break; }
      }
    }
    return count;
  }

  private generateAlternativeRoute(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
    riskZones: RiskZone[]
  ): { waypoints: RoutePoint[]; riskLevel: SafeRoute["riskLevel"] } {
    const midLat = (lat1 + lat2) / 2;
    const midLon = (lon1 + lon2) / 2;
    const offset = 0.05;

    const candidates = [
      { lat: midLat + offset, lon: midLon },
      { lat: midLat - offset, lon: midLon },
      { lat: midLat, lon: midLon + offset },
      { lat: midLat, lon: midLon - offset },
    ];

    let bestWaypoint = candidates[0];
    let minRisk = Infinity;

    for (const c of candidates) {
      let risk = 0;
      for (const zone of riskZones) {
        if (haversineDistance(c.lat, c.lon, zone.latitude, zone.longitude) < 5) risk++;
      }
      if (risk < minRisk) { minRisk = risk; bestWaypoint = c; }
    }

    return {
      waypoints: [
        { latitude: lat1, longitude: lon1, label: "Start" },
        { latitude: bestWaypoint.lat, longitude: bestWaypoint.lon, label: "Waypoint (Safe)" },
        { latitude: lat2, longitude: lon2, label: "Destination" },
      ],
      riskLevel: minRisk === 0 ? "safe" : "moderate",
    };
  }

  private calculateRouteDistance(waypoints: RoutePoint[]): number {
    let total = 0;
    for (let i = 1; i < waypoints.length; i++) {
      total += haversineDistance(
        waypoints[i - 1].latitude, waypoints[i - 1].longitude,
        waypoints[i].latitude, waypoints[i].longitude
      );
    }
    return total;
  }
}

export const riskMappingService = new RiskMappingService();
