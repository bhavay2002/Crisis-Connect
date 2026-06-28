import { db } from "../../db/db";
import { simulationRuns, disasterReports, sosAlerts, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { eventBus } from "../events/event-bus";
import { logger } from "../../utils/logger";

type Scenario = "flood" | "earthquake" | "storm" | "mass_accident" | "epidemic" | "coordinated_attack" | "infrastructure_failure";
type Intensity = "low" | "medium" | "high" | "extreme";

interface SimulationConfig {
  scenario: Scenario;
  location: string;
  latitude?: string;
  longitude?: string;
  intensity: Intensity;
  eventCount?: number;
  initiatedBy?: string;
}

interface SimulationMetrics {
  totalEventsInjected: number;
  reportsCreated: number;
  sosAlertsCreated: number;
  peakSeverity: string;
  estimatedAffected: number;
  responseTimeSimMs: number;
  queueBacklog: number;
  failureRate: number;
  scenarioScore: number;
  dispatchEfficiency: number;
  systemLoad: number;
  failures: number;
  responseScore: number;
  slaCompliance: number;
  missedCritical: number;
}

const SCENARIO_TEMPLATES: Record<Scenario, {
  reportTypes: string[];
  defaultSeverity: string;
  baseAffected: number;
  sosRatio: number;
  description: string;
}> = {
  flood: {
    reportTypes: ["flood", "flood", "flood", "road_accident"],
    defaultSeverity: "high",
    baseAffected: 5000,
    sosRatio: 0.4,
    description: "Rising water levels across multiple zones with road blockages",
  },
  earthquake: {
    reportTypes: ["earthquake", "building_collapse", "building_collapse", "fire"],
    defaultSeverity: "critical",
    baseAffected: 15000,
    sosRatio: 0.6,
    description: "Seismic event causing structural collapses, fires, and mass casualties",
  },
  storm: {
    reportTypes: ["storm", "storm", "power_outage", "road_accident"],
    defaultSeverity: "high",
    baseAffected: 8000,
    sosRatio: 0.25,
    description: "Severe cyclonic storm with power outages and transportation disruption",
  },
  mass_accident: {
    reportTypes: ["road_accident", "road_accident", "road_accident", "fire"],
    defaultSeverity: "critical",
    baseAffected: 200,
    sosRatio: 0.7,
    description: "Multi-vehicle pile-up or mass transit accident with multiple casualties",
  },
  epidemic: {
    reportTypes: ["epidemic", "epidemic", "epidemic", "water_contamination"],
    defaultSeverity: "high",
    baseAffected: 3000,
    sosRatio: 0.3,
    description: "Rapid disease spread requiring isolation and medical resource deployment",
  },
  coordinated_attack: {
    reportTypes: ["fire", "building_collapse", "gas_leak", "chemical_spill"],
    defaultSeverity: "critical",
    baseAffected: 25000,
    sosRatio: 0.65,
    description: "Multiple simultaneous incidents indicating coordinated threat scenario",
  },
  infrastructure_failure: {
    reportTypes: ["power_outage", "gas_leak", "water_contamination", "road_accident"],
    defaultSeverity: "high",
    baseAffected: 12000,
    sosRatio: 0.2,
    description: "Critical infrastructure cascade failure affecting city services",
  },
};

const INTENSITY_MULTIPLIER: Record<Intensity, number> = {
  low: 1, medium: 2, high: 4, extreme: 8,
};

function jitterCoord(base: string, range = 0.05): string {
  return (parseFloat(base || "0") + (Math.random() - 0.5) * range * 2).toFixed(5);
}

const LOCATIONS: Record<string, { lat: string; lng: string }> = {
  Mumbai: { lat: "19.0760", lng: "72.8777" },
  Delhi: { lat: "28.6139", lng: "77.2090" },
  Chennai: { lat: "13.0827", lng: "80.2707" },
  Kolkata: { lat: "22.5726", lng: "88.3639" },
  Bangalore: { lat: "12.9716", lng: "77.5946" },
};

export async function runSimulation(config: SimulationConfig): Promise<typeof simulationRuns.$inferSelect> {
  const template = SCENARIO_TEMPLATES[config.scenario];
  const multiplier = INTENSITY_MULTIPLIER[config.intensity];
  const totalEvents = config.eventCount || Math.round(3 * multiplier);
  const baseLoc = LOCATIONS[config.location] || { lat: config.latitude || "19.076", lng: config.longitude || "72.877" };

  // Get a system user for simulation events
  const [systemUser] = await db.select({ id: users.id }).from(users).limit(1);
  const userId = config.initiatedBy || systemUser?.id;

  // Create simulation run record
  const [run] = await db.insert(simulationRuns).values({
    scenario: config.scenario,
    location: config.location,
    intensity: config.intensity,
    eventCount: totalEvents,
    status: "running",
    initiatedBy: config.initiatedBy,
  }).returning();

  logger.info(`[Simulation] Starting ${config.scenario} simulation in ${config.location}`, { runId: run.id, totalEvents });

  const injectedIds: string[] = [];
  const startMs = Date.now();
  let reportsCreated = 0;
  let sosCreated = 0;

  for (let i = 0; i < totalEvents; i++) {
    const reportType = template.reportTypes[i % template.reportTypes.length] as any;
    const severity = i < Math.ceil(totalEvents * 0.4) ? template.defaultSeverity : (i < Math.ceil(totalEvents * 0.7) ? "high" : "medium");
    const lat = jitterCoord(baseLoc.lat);
    const lng = jitterCoord(baseLoc.lng);

    const [report] = await db.insert(disasterReports).values({
      userId: userId!,
      title: `[SIM] ${config.scenario.toUpperCase()} — Zone ${i + 1}`,
      type: reportType,
      severity: severity as any,
      status: "reported",
      location: `${config.location} Zone ${i + 1} (simulated)`,
      latitude: lat,
      longitude: lng,
      description: `${template.description} — Simulation event ${i + 1}/${totalEvents}. Intensity: ${config.intensity}. Run ID: ${run.id}`,
    } as any).returning();

    injectedIds.push(report.id);
    reportsCreated++;

    eventBus.publish({ type: "CRISIS_CREATED", payload: { reportId: report.id, type: reportType, severity, location: report.location } });

    // Inject SOS alerts at sosRatio
    if (Math.random() < template.sosRatio) {
      try {
        await db.insert(sosAlerts).values({
          userId: null,
          message: `[SIM] Emergency at ${config.location} Zone ${i + 1} — ${config.scenario}`,
          location: `${config.location} Zone ${i + 1} (simulated)`,
          latitude: lat,
          longitude: lng,
          emergencyType: reportType as any,
          severity: severity as any,
          status: "active",
        } as any);
        sosCreated++;
      } catch { /* continue */ }
    }

    // Small delay to simulate async injection
    await new Promise(r => setTimeout(r, 20));
  }

  const elapsed = Date.now() - startMs;
  const failureRate = parseFloat((Math.random() * 0.05 * multiplier).toFixed(3));
  const failures = Math.round(failureRate * totalEvents);
  const dispatchEfficiency = parseFloat(Math.min(0.99, (sosCreated / Math.max(totalEvents, 1)) * (1 - failureRate) * 1.4).toFixed(3));
  const systemLoad = parseFloat(Math.min(0.98, 0.25 + (totalEvents / 50) * 0.6 + failureRate).toFixed(3));
  const slaTargetMs = 120_000;
  const slaCompliance = parseFloat(Math.min(1, Math.max(0, 1 - elapsed / slaTargetMs)).toFixed(3));
  const missedCritical = Math.floor(failures * 0.3);
  const responseScore = Math.min(100, Math.round(
    slaCompliance * 35 +
    dispatchEfficiency * 35 +
    (1 - failureRate) * 20 +
    (missedCritical === 0 ? 10 : Math.max(0, 10 - missedCritical * 3))
  ));

  const metrics: SimulationMetrics = {
    totalEventsInjected: totalEvents,
    reportsCreated,
    sosAlertsCreated: sosCreated,
    peakSeverity: template.defaultSeverity,
    estimatedAffected: Math.round(template.baseAffected * multiplier),
    responseTimeSimMs: elapsed,
    queueBacklog: Math.round(totalEvents * 0.15),
    failureRate,
    scenarioScore: Math.min(100, Math.round(60 + multiplier * 10 + (reportsCreated / totalEvents) * 20)),
    dispatchEfficiency,
    systemLoad,
    failures,
    responseScore,
    slaCompliance,
    missedCritical,
  };

  const [updated] = await db.update(simulationRuns).set({
    status: "completed",
    metricsData: metrics,
    injectedEventIds: injectedIds,
    completedAt: new Date(),
  }).where(eq(simulationRuns.id, run.id)).returning();

  logger.info(`[Simulation] Completed ${config.scenario} in ${elapsed}ms`, { runId: run.id, metrics });
  return updated;
}
