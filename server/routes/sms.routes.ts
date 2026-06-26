import type { Express } from "express";
import { db } from "../db/db";
import { sosAlerts } from "@shared/schema";
import { logger } from "../utils/logger";
import { eventBus } from "../modules/events/event-bus";

type EmergencyType = "fire" | "flood" | "earthquake" | "storm" | "road_accident" | "epidemic" | "landslide" | "gas_leak" | "building_collapse" | "chemical_spill" | "power_outage" | "water_contamination" | "other";

const smsCommandMap: Record<string, { description: string; emergencyType: EmergencyType; severity: "low" | "medium" | "high" | "critical" }> = {
  HELP:       { description: "Emergency help requested via SMS",       emergencyType: "other",         severity: "high"     },
  SOS:        { description: "SOS activated via SMS",                  emergencyType: "other",         severity: "critical" },
  FIRE:       { description: "Fire emergency reported via SMS",        emergencyType: "fire",          severity: "critical" },
  FLOOD:      { description: "Flood emergency reported via SMS",       emergencyType: "flood",         severity: "high"     },
  MEDICAL:    { description: "Medical emergency reported via SMS",     emergencyType: "other",         severity: "critical" },
  ACCIDENT:   { description: "Road accident reported via SMS",         emergencyType: "road_accident", severity: "high"     },
  EARTHQUAKE: { description: "Earthquake emergency reported via SMS",  emergencyType: "earthquake",    severity: "critical" },
  STORM:      { description: "Storm emergency reported via SMS",       emergencyType: "storm",         severity: "high"     },
  GAS:        { description: "Gas leak reported via SMS",              emergencyType: "gas_leak",      severity: "critical" },
  LANDSLIDE:  { description: "Landslide reported via SMS",             emergencyType: "landslide",     severity: "high"     },
};

function parseSMSCommand(body: string): { command: string; description: string; emergencyType: EmergencyType; severity: "low" | "medium" | "high" | "critical" } {
  const upper = body.trim().toUpperCase();
  for (const [key, data] of Object.entries(smsCommandMap)) {
    if (upper.startsWith(key)) {
      return { command: key, ...data };
    }
  }
  return { command: "HELP", description: `Emergency message: ${body}`, emergencyType: "other", severity: "high" };
}

export function registerSMSRoutes(app: Express) {
  // Twilio-compatible SMS webhook for offline SOS
  // Receives SMS in standard Twilio format (form-encoded)
  app.post("/api/sms/webhook", async (req: any, res) => {
    try {
      const from: string = req.body?.From || req.body?.from || "unknown";
      const messageBody: string = req.body?.Body || req.body?.body || "";

      if (!messageBody) {
        return res.status(200).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Message>No message body</Message></Response>");
      }

      const { command, description, emergencyType, severity } = parseSMSCommand(messageBody);

      // Create SOS alert from SMS — phone number as location identifier
      const [sos] = await db
        .insert(sosAlerts)
        .values({
          location: `SMS from ${from}`,
          description,
          emergencyType,
          severity,
          status: "active",
          contactNumber: from,
        })
        .returning();

      eventBus.publish({
        type: "SOS_ACTIVATED",
        payload: { sosId: sos.id, userId: from, location: `SMS from ${from}` },
      });

      logger.info(`SMS SOS created from ${from}`, { sosId: sos.id, command });

      // Respond with TwiML
      res.set("Content-Type", "text/xml");
      res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>CrisisConnect received your ${command} alert. Emergency services have been notified. Stay safe. ID: ${sos.id.slice(0, 8).toUpperCase()}</Message>
</Response>`);
    } catch (err) {
      logger.error("SMS webhook error", err instanceof Error ? err : undefined);
      res.set("Content-Type", "text/xml");
      res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>CrisisConnect received your message. If this is an emergency, please call emergency services.</Message>
</Response>`);
    }
  });

  // SMS status callback (Twilio delivery reports)
  app.post("/api/sms/status", async (req: any, res) => {
    const { MessageSid, MessageStatus, To } = req.body;
    logger.info(`SMS status update`, { messageSid: MessageSid, status: MessageStatus, to: To });
    res.status(204).send();
  });

  // Test endpoint (dev only) to simulate an incoming SMS
  app.post("/api/sms/simulate", async (req: any, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ message: "Not available in production" });
    }
    try {
      const { from = "+919999999999", body = "HELP I need assistance" } = req.body;
      const { command, description, emergencyType, severity } = parseSMSCommand(body);
      const [sos] = await db
        .insert(sosAlerts)
        .values({
          location: `SMS from ${from}`,
          description,
          emergencyType,
          severity,
          status: "active",
          contactNumber: from,
        })
        .returning();
      res.json({ message: "SMS simulated", sosId: sos.id, command, description });
    } catch (err) {
      logger.error("SMS simulate error", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Simulation failed" });
    }
  });
}
