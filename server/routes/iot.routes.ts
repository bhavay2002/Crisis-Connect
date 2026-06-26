import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { storage } from "../db/storage";
import { db } from "../db/db";
import { incidentLogs, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "../utils/logger";

let broadcastToAll: (message: any) => void = () => {};

export function setBroadcastFunction(fn: (message: any) => void) {
  broadcastToAll = fn;
}

const IOT_SENSOR_MAP: Record<string, {
  emergencyType: string;
  severity: "low" | "medium" | "high" | "critical";
  titleTemplate: string;
  autoDispatch: boolean;
}> = {
  fire_alarm: {
    emergencyType: "fire",
    severity: "critical",
    titleTemplate: "Automatic fire alarm triggered",
    autoDispatch: true,
  },
  gas_detector: {
    emergencyType: "gas_leak",
    severity: "critical",
    titleTemplate: "Gas leak sensor activated",
    autoDispatch: true,
  },
  flood_sensor: {
    emergencyType: "flood",
    severity: "high",
    titleTemplate: "Flood level sensor exceeded threshold",
    autoDispatch: false,
  },
  seismic_sensor: {
    emergencyType: "earthquake",
    severity: "high",
    titleTemplate: "Seismic activity detected",
    autoDispatch: false,
  },
  structural_monitor: {
    emergencyType: "building_collapse",
    severity: "critical",
    titleTemplate: "Structural integrity alert",
    autoDispatch: true,
  },
  chemical_sensor: {
    emergencyType: "chemical_spill",
    severity: "critical",
    titleTemplate: "Chemical hazard sensor triggered",
    autoDispatch: true,
  },
  power_monitor: {
    emergencyType: "power_outage",
    severity: "medium",
    titleTemplate: "Power grid anomaly detected",
    autoDispatch: false,
  },
  water_quality: {
    emergencyType: "water_contamination",
    severity: "high",
    titleTemplate: "Water contamination sensor alert",
    autoDispatch: false,
  },
};

export function registerIoTRoutes(app: Express) {

  app.post("/api/iot/event", async (req, res) => {
    try {
      const {
        sensor_type,
        value,
        location,
        latitude,
        longitude,
        sensor_id,
        device_owner,
        threshold_exceeded,
        reading,
      } = req.body;

      if (!sensor_type || !location) {
        return res.status(400).json({ message: "sensor_type and location are required" });
      }

      const sensorConfig = IOT_SENSOR_MAP[sensor_type];
      if (!sensorConfig) {
        return res.status(400).json({
          message: `Unknown sensor_type: ${sensor_type}`,
          validTypes: Object.keys(IOT_SENSOR_MAP),
        });
      }

      const description =
        `IoT Sensor Alert: ${sensor_type}. ` +
        `Value: ${value || reading || "triggered"}. ` +
        `Sensor ID: ${sensor_id || "unknown"}. ` +
        `Threshold exceeded: ${threshold_exceeded ? "yes" : "unknown"}. ` +
        `Auto-generated from IoT network.`;

      const SYSTEM_USER_ID = await getSystemUserId();

      const report = await storage.createDisasterReport({
        title: sensorConfig.titleTemplate + (sensor_id ? ` [${sensor_id}]` : ""),
        description,
        type: sensorConfig.emergencyType as any,
        severity: sensorConfig.severity,
        location,
        latitude: latitude?.toString(),
        longitude: longitude?.toString(),
        userId: SYSTEM_USER_ID,
        mediaUrls: [],
      });

      await db.insert(incidentLogs).values({
        entityId: report.id,
        entityType: "report",
        fromState: "none",
        toState: "reported",
        triggeredBy: "iot_system",
        reason: `IoT event: ${sensor_type} = ${value || "triggered"}`,
        metadata: {
          sensorType: sensor_type,
          sensorId: sensor_id,
          value,
          reading,
          thresholdExceeded: threshold_exceeded,
          deviceOwner: device_owner,
          autoDispatch: sensorConfig.autoDispatch,
        },
        timestamp: new Date(),
      });

      broadcastToAll({
        type: "iot_alert",
        data: {
          reportId: report.id,
          sensorType: sensor_type,
          emergencyType: sensorConfig.emergencyType,
          severity: sensorConfig.severity,
          location,
          latitude,
          longitude,
          autoDispatch: sensorConfig.autoDispatch,
          timestamp: new Date().toISOString(),
        },
      });

      logger.warn("IoT event processed — report created", {
        reportId: report.id,
        sensorType: sensor_type,
        severity: sensorConfig.severity,
        autoDispatch: sensorConfig.autoDispatch,
      });

      res.status(201).json({
        message: "IoT event processed",
        reportId: report.id,
        emergencyType: sensorConfig.emergencyType,
        severity: sensorConfig.severity,
        autoDispatch: sensorConfig.autoDispatch,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("IoT event processing error", error as Error);
      res.status(500).json({ message: "Failed to process IoT event" });
    }
  });

  app.get("/api/iot/sensor-types", (req, res) => {
    res.json({
      sensorTypes: Object.entries(IOT_SENSOR_MAP).map(([key, config]) => ({
        sensorType: key,
        emergencyType: config.emergencyType,
        defaultSeverity: config.severity,
        autoDispatch: config.autoDispatch,
      })),
    });
  });
}

let cachedSystemUserId: string | null = null;

async function getSystemUserId(): Promise<string> {
  if (cachedSystemUserId) return cachedSystemUserId;

  try {
    const systemUsers = await db.select().from(users)
      .where(eq(users.email, "system@crisisconnect.internal"));
    if (systemUsers[0]) {
      cachedSystemUserId = systemUsers[0].id;
      return cachedSystemUserId;
    }

    const hash = await bcrypt.hash("iot-system-key-2026", 10);
    const [created] = await db.insert(users).values({
      email: "system@crisisconnect.internal",
      password: hash,
      name: "IoT System",
      role: "admin",
    }).returning();
    cachedSystemUserId = created.id;
    return cachedSystemUserId;
  } catch {
    try {
      const anyAdmin = await db.select().from(users)
        .where(eq(users.role, "admin"));
      if (anyAdmin[0]) {
        cachedSystemUserId = anyAdmin[0].id;
        return cachedSystemUserId;
      }
    } catch {
      // ignore
    }
    return "";
  }
}
