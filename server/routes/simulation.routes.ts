import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { runSimulation } from "../modules/simulation/simulation-engine";
import { db } from "../db/db";
import { simulationRuns } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { logger } from "../utils/logger";

const SCENARIO_META = {
  flood:                 { label: "Flood",                  icon: "🌊", description: "Rising water levels, road blockages", defaultIntensity: "high"   },
  earthquake:            { label: "Earthquake",             icon: "🌍", description: "Seismic event, building collapses",    defaultIntensity: "extreme" },
  storm:                 { label: "Cyclonic Storm",         icon: "🌪️",  description: "Severe wind, power outages",          defaultIntensity: "high"   },
  mass_accident:         { label: "Mass Accident",          icon: "🚗", description: "Multi-vehicle or mass transit crash",  defaultIntensity: "high"   },
  epidemic:              { label: "Epidemic",               icon: "🦠", description: "Rapid disease spread scenario",        defaultIntensity: "medium" },
  coordinated_attack:    { label: "Coordinated Attack",     icon: "⚠️",  description: "Multi-site simultaneous incidents",   defaultIntensity: "extreme" },
  infrastructure_failure:{ label: "Infrastructure Failure", icon: "🏗️",  description: "Utility cascade failure scenario",    defaultIntensity: "medium" },
};

export function registerSimulationRoutes(app: Express) {
  app.get("/api/simulation/scenarios", isAuthenticated, (req, res) => {
    res.json({ scenarios: SCENARIO_META });
  });

  app.post("/api/simulation/run", isAuthenticated, requireRole("admin", "authority", "super_admin"), async (req: any, res) => {
    try {
      const { scenario, location, intensity = "medium", eventCount } = req.body;
      if (!scenario || !location) return res.status(400).json({ message: "scenario and location are required" });
      if (!SCENARIO_META[scenario as keyof typeof SCENARIO_META]) {
        return res.status(400).json({ message: `Invalid scenario. Choose: ${Object.keys(SCENARIO_META).join(", ")}` });
      }

      logger.info(`[Simulation] Starting: ${scenario} in ${location}`, { initiatedBy: req.user.userId });

      // Run simulation (async — returns when complete, usually < 5s for small counts)
      const run = await runSimulation({
        scenario,
        location,
        intensity,
        eventCount: Math.min(eventCount || 6, 20),
        initiatedBy: req.user.userId,
      });

      res.status(201).json(run);
    } catch (err) {
      logger.error("Simulation failed", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Simulation failed", error: (err as Error).message });
    }
  });

  app.get("/api/simulation/runs", isAuthenticated, async (req: any, res) => {
    try {
      const runs = await db.select().from(simulationRuns).orderBy(desc(simulationRuns.startedAt)).limit(20);
      res.json({ runs });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/simulation/runs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const [run] = await db.select().from(simulationRuns).where(eq(simulationRuns.id, req.params.id));
      if (!run) return res.status(404).json({ message: "Simulation run not found" });
      res.json(run);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
