import type { Express } from "express";
import { storage } from "../db/storage";
import { isAuthenticated } from "../middleware/jwtAuth";
import { insertSOSAlertSchema, incidentLogs } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { dispatchService, slaEscalationService } from "../modules/sos/dispatch.service";
import { db } from "../db/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../utils/logger";

// Placeholder for broadcast function - will be injected via index.ts
let broadcastToAll: (message: any) => void = () => {};

export function setBroadcastFunction(fn: (message: any) => void) {
  broadcastToAll = fn;
}

export function registerSOSRoutes(app: Express) {
  // Create SOS alert
  app.post("/api/sos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const validatedData = insertSOSAlertSchema.parse({
        ...req.body,
        userId,
      });

      const sosAlert = await storage.createSOSAlert(validatedData);

      // Log state transition: none → CREATED
      await db.insert(incidentLogs).values({
        entityId: sosAlert.id,
        entityType: "sos",
        fromState: "none",
        toState: "CREATED",
        triggeredBy: userId,
        reason: "SOS alert created by user",
        metadata: { emergencyType: sosAlert.emergencyType, severity: sosAlert.severity },
        timestamp: new Date(),
      }).catch(() => {});

      // Broadcast new SOS alert to all connected WebSocket clients
      broadcastToAll({ type: "new_sos_alert", data: sosAlert });

      res.status(201).json(sosAlert);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      logger.error("Error creating SOS alert", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to create SOS alert" });
    }
  });

  // Get all SOS alerts (responders only)
  app.get("/api/sos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only responders (volunteer, NGO, admin) can view all SOS alerts
      if (!user.role || !["volunteer", "ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only volunteers, NGOs, and admins can view all SOS alerts" 
        });
      }

      const alerts = await storage.getAllSOSAlerts();
      res.json(alerts);
    } catch (error) {
      logger.error("Error fetching SOS alerts", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to fetch SOS alerts" });
    }
  });

  // Get active SOS alerts (responders only)
  app.get("/api/sos/active", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only responders (volunteer, NGO, admin) can view active SOS alerts
      if (!user.role || !["volunteer", "ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only volunteers, NGOs, and admins can view active SOS alerts" 
        });
      }

      const alerts = await storage.getActiveSOSAlerts();
      res.json(alerts);
    } catch (error) {
      logger.error("Error fetching active SOS alerts", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to fetch active SOS alerts" });
    }
  });

  // Get user's own SOS alerts
  app.get("/api/sos/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const alerts = await storage.getSOSAlertsByUser(userId);
      res.json(alerts);
    } catch (error) {
      logger.error("Error fetching user SOS alerts", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to fetch user SOS alerts" });
    }
  });

  // Get specific SOS alert (authenticated — contains PII: coordinates, contact number)
  app.get("/api/sos/:id", isAuthenticated, async (req: any, res) => {
    try {
      const alert = await storage.getSOSAlert(req.params.id);
      if (!alert) {
        return res.status(404).json({ message: "SOS alert not found" });
      }
      res.json(alert);
    } catch (error) {
      logger.error("Error fetching SOS alert", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to fetch SOS alert" });
    }
  });

  // Respond to SOS alert (responders only)
  app.post("/api/sos/:id/respond", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only responders (volunteer, NGO, admin) can respond to SOS alerts
      if (!user.role || !["volunteer", "ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only volunteers, NGOs, and admins can respond to SOS alerts" 
        });
      }

      // Check if SOS alert exists
      const alert = await storage.getSOSAlert(id);
      if (!alert) {
        return res.status(404).json({ message: "SOS alert not found" });
      }

      // Respond to the alert
      const updatedAlert = await storage.respondToSOSAlert(id, userId);

      // Log transition: BROADCASTED → ACCEPTED
      await db.insert(incidentLogs).values({
        entityId: id,
        entityType: "sos",
        fromState: "BROADCASTED",
        toState: "ACCEPTED",
        triggeredBy: userId,
        reason: `Responder ${user.name} accepted the SOS`,
        metadata: { responderId: userId, responderRole: user.role },
        timestamp: new Date(),
      }).catch(() => {});

      // Broadcast response to all connected WebSocket clients
      if (updatedAlert) {
        broadcastToAll({ type: "sos_alert_responded", data: updatedAlert });
      }

      res.json(updatedAlert);
    } catch (error) {
      logger.error("Error responding to SOS alert", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to respond to SOS alert" });
    }
  });

  // Resolve SOS alert
  app.post("/api/sos/:id/resolve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      // Check if SOS alert exists
      const alert = await storage.getSOSAlert(id);
      if (!alert) {
        return res.status(404).json({ message: "SOS alert not found" });
      }

      // Only the creator or the responder can resolve the alert
      if (alert.userId !== userId && alert.respondedBy !== userId) {
        return res.status(403).json({ 
          message: "Only the creator or responder can resolve this SOS alert" 
        });
      }

      const updatedAlert = await storage.resolveSOSAlert(id);

      // Log transition: IN_PROGRESS → RESOLVED
      await db.insert(incidentLogs).values({
        entityId: id,
        entityType: "sos",
        fromState: "IN_PROGRESS",
        toState: "RESOLVED",
        triggeredBy: userId,
        reason: `SOS resolved by ${userId}`,
        metadata: { resolvedAt: new Date().toISOString() },
        timestamp: new Date(),
      }).catch(() => {});

      // Cancel SLA timers since resolved
      slaEscalationService.cancelEscalation(id);

      // Broadcast resolution to all connected WebSocket clients
      if (updatedAlert) {
        broadcastToAll({ type: "sos_alert_resolved", data: updatedAlert });
      }

      res.json(updatedAlert);
    } catch (error) {
      logger.error("Error resolving SOS alert", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to resolve SOS alert" });
    }
  });

  // Get state transition history for an SOS
  app.get("/api/sos/:id/history", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const alert = await storage.getSOSAlert(id);
      if (!alert) return res.status(404).json({ message: "SOS alert not found" });

      const logs = await db.select().from(incidentLogs)
        .where(eq(incidentLogs.entityId, id))
        .orderBy(sql`${incidentLogs.timestamp} ASC`);

      const stateMachine = {
        states: ["CREATED", "VERIFIED", "BROADCASTED", "ACCEPTED", "IN_PROGRESS", "RESOLVED", "CLOSED"],
        transitions: {
          CREATED: ["VERIFIED"],
          VERIFIED: ["BROADCASTED"],
          BROADCASTED: ["ACCEPTED"],
          ACCEPTED: ["IN_PROGRESS"],
          IN_PROGRESS: ["RESOLVED"],
          RESOLVED: ["CLOSED"],
        },
      };

      res.json({
        sosId: id,
        currentStatus: alert.status,
        history: logs,
        stateMachine,
        totalTransitions: logs.length,
      });
    } catch (error) {
      logger.error("Error fetching SOS history", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  // Smart dispatch: find best responders for an SOS
  app.post("/api/sos/:id/dispatch", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const alert = await storage.getSOSAlert(id);
      if (!alert) return res.status(404).json({ message: "SOS alert not found" });

      const user = await storage.getUser(req.user.userId);
      if (!user || !["volunteer", "ngo", "admin"].includes(user.role || "")) {
        return res.status(403).json({ message: "Only responders can trigger dispatch" });
      }

      const lat = alert.latitude ? parseFloat(alert.latitude) : 20.5937;
      const lon = alert.longitude ? parseFloat(alert.longitude) : 78.9629;

      const result = await dispatchService.findBestResponders(
        id, alert.emergencyType, lat, lon,
        req.body.radiusKm || 25, req.body.maxResults || 5
      );

      slaEscalationService.setupEscalation(id, new Date(alert.createdAt), broadcastToAll);

      broadcastToAll({ type: "sos_dispatch_started", data: { sosId: id, respondersFound: result.recommended.length } });
      res.json(result);
    } catch (error) {
      logger.error("Error dispatching SOS", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Dispatch failed" });
    }
  });

  // Get dispatch status for an SOS
  app.get("/api/sos/:id/dispatch-status", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const alert = await storage.getSOSAlert(id);
      if (!alert) return res.status(404).json({ message: "SOS alert not found" });

      res.json({
        sosId: id,
        status: alert.status,
        respondedBy: alert.respondedBy,
        respondedAt: alert.respondedAt,
        resolvedAt: alert.resolvedAt,
        createdAt: alert.createdAt,
        secondsElapsed: Math.floor((Date.now() - new Date(alert.createdAt).getTime()) / 1000),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get dispatch status" });
    }
  });

  // Update SOS alert status
  app.patch("/api/sos/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { id } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = ["active", "responding", "resolved", "cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Check if SOS alert exists
      const alert = await storage.getSOSAlert(id);
      if (!alert) {
        return res.status(404).json({ message: "SOS alert not found" });
      }

      // Only the creator or responder can update status
      if (alert.userId !== userId && alert.respondedBy !== userId) {
        return res.status(403).json({ 
          message: "Only the creator or responder can update this SOS alert status" 
        });
      }

      const updatedAlert = await storage.updateSOSAlertStatus(
        id, 
        status as "active" | "responding" | "resolved" | "cancelled"
      );

      // Broadcast status update to all connected WebSocket clients
      if (updatedAlert) {
        broadcastToAll({ type: "sos_alert_updated", data: updatedAlert });
      }

      res.json(updatedAlert);
    } catch (error) {
      logger.error("Error updating SOS alert status", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to update SOS alert status" });
    }
  });
}
