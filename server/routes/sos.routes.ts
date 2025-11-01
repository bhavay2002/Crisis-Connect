import type { Express } from "express";
import { storage } from "../db/storage";
import { isAuthenticated } from "../middleware/jwtAuth";
import { insertSOSAlertSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

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

      // Broadcast new SOS alert to all connected WebSocket clients
      broadcastToAll({ type: "new_sos_alert", data: sosAlert });

      res.status(201).json(sosAlert);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating SOS alert:", error);
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
      console.error("Error fetching SOS alerts:", error);
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
      console.error("Error fetching active SOS alerts:", error);
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
      console.error("Error fetching user SOS alerts:", error);
      res.status(500).json({ message: "Failed to fetch user SOS alerts" });
    }
  });

  // Get specific SOS alert
  app.get("/api/sos/:id", async (req, res) => {
    try {
      const alert = await storage.getSOSAlert(req.params.id);
      if (!alert) {
        return res.status(404).json({ message: "SOS alert not found" });
      }
      res.json(alert);
    } catch (error) {
      console.error("Error fetching SOS alert:", error);
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

      // Broadcast response to all connected WebSocket clients
      if (updatedAlert) {
        broadcastToAll({ type: "sos_alert_responded", data: updatedAlert });
      }

      res.json(updatedAlert);
    } catch (error) {
      console.error("Error responding to SOS alert:", error);
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

      // Broadcast resolution to all connected WebSocket clients
      if (updatedAlert) {
        broadcastToAll({ type: "sos_alert_resolved", data: updatedAlert });
      }

      res.json(updatedAlert);
    } catch (error) {
      console.error("Error resolving SOS alert:", error);
      res.status(500).json({ message: "Failed to resolve SOS alert" });
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
      console.error("Error updating SOS alert status:", error);
      res.status(500).json({ message: "Failed to update SOS alert status" });
    }
  });
}
