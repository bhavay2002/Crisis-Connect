import { db } from "../../db/db";
import { disasterReports, disasterPredictions } from "@shared/schema";
import { desc, gt, sql } from "drizzle-orm";
import { logger } from "../../utils/logger";
import { decisionEngine } from "../decisions/decision-engine.service";

export interface LivePrediction {
  id: string;
  location: string;
  disasterType: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  probability: number;
  timeWindow: string;
  recommendedActions: string[];
  confidence: number;
  factors: string[];
  latitude: string;
  longitude: string;
  createdAt: string;
  validUntil: string;
}

const CITY_ZONES = [
  { name: "Mumbai",    lat: 19.076,  lng: 72.877  },
  { name: "Delhi",     lat: 28.614,  lng: 77.209  },
  { name: "Chennai",   lat: 13.083,  lng: 80.271  },
  { name: "Kolkata",   lat: 22.573,  lng: 88.364  },
  { name: "Bangalore", lat: 12.972,  lng: 77.595  },
];

const RECOMMENDED_ACTIONS: Record<string, string[]> = {
  flood:                  ["Pre-position water rescue teams", "Activate flood warning sirens", "Open evacuation shelters", "Alert downstream communities"],
  earthquake:             ["Inspect critical infrastructure", "Pre-deploy USAR teams", "Activate hospital surge protocol", "Clear debris-prone roads"],
  fire:                   ["Pre-position fire suppression units", "Alert neighboring districts", "Evacuate high-risk residential zones", "Secure gas/power lines"],
  storm:                  ["Secure loose structures", "Pre-deploy power restoration crews", "Open emergency shelters", "Issue evacuation advisories"],
  epidemic:               ["Activate disease surveillance", "Pre-position medical supplies", "Quarantine high-risk zones", "Alert hospitals for surge"],
  road_accident:          ["Pre-position ambulances on high-risk corridors", "Alert trauma centers", "Deploy traffic control"],
  building_collapse:      ["Deploy structural inspection teams", "Pre-position heavy rescue", "Clear access routes", "Activate USAR protocol"],
  power_outage:           ["Pre-position generator crews", "Alert hospitals to switch backup power", "Protect critical facilities"],
  water_contamination:    ["Alert water utility teams", "Issue boil-water advisory", "Distribute bottled water", "Test distribution points"],
  gas_leak:               ["Alert gas utility emergency team", "Evacuate 500m radius", "No ignition sources advisory"],
  chemical_spill:         ["Activate HazMat response", "Establish safety perimeter", "Alert poison control", "Wind-direction evacuation"],
  default:                ["Pre-deploy 2 rescue teams", "Alert local volunteers", "Brief command center", "Increase patrol frequency"],
};

function getTimeWindow(probability: number): string {
  if (probability >= 0.85) return "15–30 minutes";
  if (probability >= 0.75) return "30–60 minutes";
  if (probability >= 0.60) return "1–3 hours";
  if (probability >= 0.45) return "3–8 hours";
  return "8–24 hours";
}

function getRiskLabel(riskLevel: string): "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" {
  if (riskLevel === "very_high") return "VERY_HIGH";
  if (riskLevel === "high")      return "HIGH";
  if (riskLevel === "medium")    return "MEDIUM";
  return "LOW";
}

function probabilityFromRisk(riskLevel: string, frequency: number): number {
  const base: Record<string, number> = {
    very_high: 0.85, high: 0.72, medium: 0.55, low: 0.35, very_low: 0.18,
  };
  const b = base[riskLevel] ?? 0.30;
  const boost = Math.min(0.12, frequency * 0.015);
  return Math.min(0.97, parseFloat((b + boost).toFixed(2)));
}

async function getLocationFrequencies(
  lat: number, lng: number, radiusKm = 50
): Promise<Map<string, { type: string; freq: number; lastSeen: Date }>> {
  const reports = await db.select({
    type:      disasterReports.type,
    severity:  disasterReports.severity,
    latitude:  disasterReports.latitude,
    longitude: disasterReports.longitude,
    createdAt: disasterReports.createdAt,
  }).from(disasterReports).orderBy(desc(disasterReports.createdAt)).limit(500);

  const buckets = new Map<string, { type: string; freq: number; lastSeen: Date }>();

  for (const r of reports) {
    if (!r.latitude || !r.longitude) continue;
    const rLat = parseFloat(r.latitude);
    const rLng = parseFloat(r.longitude);
    const dlat = (rLat - lat) * 111;
    const dlng = (rLng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
    if (Math.sqrt(dlat * dlat + dlng * dlng) > radiusKm) continue;

    const key = r.type;
    if (buckets.has(key)) {
      const b = buckets.get(key)!;
      b.freq++;
      if (new Date(r.createdAt) > b.lastSeen) b.lastSeen = new Date(r.createdAt);
    } else {
      buckets.set(key, { type: r.type, freq: 1, lastSeen: new Date(r.createdAt) });
    }
  }
  return buckets;
}

async function buildPredictionsForZone(
  zone: { name: string; lat: number; lng: number }
): Promise<Array<typeof disasterPredictions.$inferInsert>> {
  const freqMap = await getLocationFrequencies(zone.lat, zone.lng);
  const now = new Date();
  const results: Array<typeof disasterPredictions.$inferInsert> = [];

  for (const [type, { freq }] of freqMap) {
    if (freq < 1) continue;

    let riskLevel: string = "low";
    if (freq >= 8) riskLevel = "very_high";
    else if (freq >= 5) riskLevel = "high";
    else if (freq >= 3) riskLevel = "medium";

    const confidence = Math.min(95, 40 + freq * 8);
    const validUntil = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    const factors: string[] = ["historical_pattern"];
    if (freq >= 5) factors.push("high_frequency_zone");
    if (type === "flood" || type === "storm") factors.push("weather_correlation");
    if (type === "earthquake") factors.push("seismic_history");

    results.push({
      disasterType: type as any,
      predictedArea: zone.name,
      latitude:  zone.lat.toString(),
      longitude: zone.lng.toString(),
      radius: 15000,
      riskLevel: riskLevel as any,
      confidence,
      weatherData: null,
      seismicData: null,
      predictionFactors: factors,
      validFrom: now,
      validUntil,
    } as any);
  }
  return results;
}

export async function generateAllPredictions(): Promise<LivePrediction[]> {
  logger.info("[PredictiveEngine] Starting prediction generation for all zones");

  const allInserts: Array<typeof disasterPredictions.$inferInsert> = [];

  for (const zone of CITY_ZONES) {
    try {
      const zonePreds = await buildPredictionsForZone(zone);
      allInserts.push(...zonePreds);
    } catch (err) {
      logger.warn(`[PredictiveEngine] Zone ${zone.name} failed`, { error: String(err) });
    }
  }

  if (allInserts.length === 0) {
    return await getLivePredictions();
  }

  const saved = await db.insert(disasterPredictions).values(allInserts as any).returning();

  // §28 — Auto-create Decision Engine entries for high-risk predictions
  // VERY_HIGH → autoExecutable: true (auto-PREDEPLOY without operator approval)
  // HIGH      → autoExecutable: false (still needs operator approval)
  for (const pred of saved) {
    const risk = (pred as any).riskLevel;
    if (risk === "very_high" || risk === "high") {
      try {
        const probability = probabilityFromRisk(risk, 5);

        // Build a synthetic report object that the decision engine understands.
        // For VERY_HIGH, we push aiScore above the 0.8 auto-execute threshold.
        const aiScore = risk === "very_high"
          ? Math.max(0.82, probability)  // guarantees autoExecutable = true
          : Math.min(0.79, probability); // stays below auto-execute for HIGH

        const fakeReport = {
          id: `pred-${(pred as any).id}`,
          title: `[PREDICTION] ${risk.toUpperCase()} ${(pred as any).disasterType} risk — ${(pred as any).predictedArea}`,
          type: (pred as any).disasterType,
          severity: risk === "very_high" ? "critical" : "high",
          location: (pred as any).predictedArea,
          description: `AI Predictive Engine detected ${risk} risk for ${(pred as any).disasterType} in ${(pred as any).predictedArea}. Probability: ${Math.round(probability * 100)}%. Confidence: ${(pred as any).confidence}%. Based on: ${((pred as any).predictionFactors || []).join(", ")}.`,
          userId: null,
          aiScore,
          confidence: (pred as any).confidence / 100,
          urgencyScore: aiScore,
          latitude: (pred as any).latitude,
          longitude: (pred as any).longitude,
        } as any;

        const decision = await decisionEngine.generateDecision(fakeReport);

        // Emit prediction.actioned event for VERY_HIGH auto-executions
        if (risk === "very_high" && decision) {
          const { eventStore: es, EVENT_TYPES: ET } = await import("../events/event-store.service");
          es.append({
            eventType:  ET.PREDICTION_ACTIONED,
            entityId:   (pred as any).id,
            entityType: "prediction",
            payload: {
              predictionId: (pred as any).id,
              decisionId:   (decision as any).id ?? null,
              risk,
              type:         (pred as any).disasterType,
              area:         (pred as any).predictedArea,
              probability,
              autoExecuted: true,
              actionedAt:   new Date().toISOString(),
            },
          }).catch(() => {});
        }
      } catch {
        // non-blocking
      }
    }
  }

  logger.info(`[PredictiveEngine] Generated ${saved.length} predictions`);
  return await getLivePredictions();
}

export async function getLivePredictions(): Promise<LivePrediction[]> {
  const now = new Date();
  const rows = await db.select().from(disasterPredictions)
    .where(gt(disasterPredictions.validUntil, now))
    .orderBy(desc(disasterPredictions.createdAt))
    .limit(50);

  return rows.map((r: any) => {
    const risk = getRiskLabel(r.riskLevel);
    const probability = probabilityFromRisk(r.riskLevel, r.confidence ? Math.round(r.confidence / 15) : 3);
    const type = r.disasterType ?? "unknown";
    const actions = RECOMMENDED_ACTIONS[type] ?? RECOMMENDED_ACTIONS.default;

    return {
      id: r.id,
      location: r.predictedArea ?? "Unknown Zone",
      disasterType: type,
      riskLevel: risk,
      probability,
      timeWindow: getTimeWindow(probability),
      recommendedActions: actions.slice(0, 4),
      confidence: r.confidence ?? 60,
      factors: (r.predictionFactors as string[]) ?? ["historical_pattern"],
      latitude: r.latitude ?? "0",
      longitude: r.longitude ?? "0",
      createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
      validUntil: r.validUntil?.toISOString() ?? new Date().toISOString(),
    };
  });
}

export async function getPredictionStats() {
  const now = new Date();
  const rows = await db.select().from(disasterPredictions)
    .where(gt(disasterPredictions.validUntil, now));

  const total = rows.length;
  const high = rows.filter((r: any) => r.riskLevel === "high" || r.riskLevel === "very_high").length;
  const avgConf = total > 0
    ? Math.round(rows.reduce((s: number, r: any) => s + (r.confidence ?? 60), 0) / total)
    : 0;

  const byType: Record<string, number> = {};
  for (const r of rows) {
    const t = (r as any).disasterType ?? "unknown";
    byType[t] = (byType[t] ?? 0) + 1;
  }

  return { total, high, avgConfidence: avgConf, byType };
}
