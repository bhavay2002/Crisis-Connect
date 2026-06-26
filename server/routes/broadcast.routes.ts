import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireAdmin } from "../middleware/roleAuth";
import { storage } from "../db/storage";
import { logger } from "../utils/logger";

let broadcastToAll: (message: any) => void = () => {};

export function setBroadcastFunction(fn: (message: any) => void) {
  broadcastToAll = fn;
}

interface BroadcastAlert {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  scope: "global" | "regional";
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
}

const broadcastHistory: BroadcastAlert[] = [];

export function registerBroadcastRoutes(app: Express) {
  // Send broadcast alert (admin/ngo only)
  app.post("/api/alerts/broadcast", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);

      if (!user || !["admin", "ngo"].includes(user.role || "")) {
        return res.status(403).json({ message: "Only admins and NGOs can send broadcast alerts" });
      }

      const { title, message, severity, scope, latitude, longitude, radiusKm, expiresInMinutes } = req.body;

      if (!title || !message || !severity) {
        return res.status(400).json({ message: "title, message, severity required" });
      }

      const alert: BroadcastAlert = {
        id: `broadcast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        message,
        severity: severity || "info",
        scope: scope || "global",
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        expiresAt: expiresInMinutes
          ? new Date(Date.now() + expiresInMinutes * 60_000).toISOString()
          : undefined,
      };

      broadcastHistory.unshift(alert);
      if (broadcastHistory.length > 100) broadcastHistory.pop();

      broadcastToAll({
        type: "broadcast_alert",
        data: alert,
      });

      logger.info("Broadcast alert sent", {
        alertId: alert.id,
        severity: alert.severity,
        scope: alert.scope,
        sentBy: userId,
      });

      res.status(201).json(alert);
    } catch (error) {
      logger.error("Broadcast alert error", error as Error);
      res.status(500).json({ message: "Failed to send broadcast alert" });
    }
  });

  // Get recent broadcast alerts
  app.get("/api/alerts/broadcast", isAuthenticated, async (req: any, res) => {
    try {
      const now = new Date();
      const active = broadcastHistory.filter(a =>
        !a.expiresAt || new Date(a.expiresAt) > now
      );
      res.json({ alerts: active, total: active.length });
    } catch (error) {
      logger.error("Get broadcast alerts error", error as Error);
      res.status(500).json({ message: "Failed to fetch broadcast alerts" });
    }
  });

  // Send SOS dispatch notification
  app.post("/api/alerts/sos-dispatch", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { sosId, responderId, message } = req.body;

      if (!sosId || !responderId) {
        return res.status(400).json({ message: "sosId and responderId required" });
      }

      broadcastToAll({
        type: "sos_dispatch_notification",
        data: {
          sosId,
          responderId,
          message: message || "You have been dispatched to an SOS emergency",
          dispatchedAt: new Date().toISOString(),
        },
      });

      res.json({ success: true, message: "Dispatch notification sent" });
    } catch (error) {
      logger.error("SOS dispatch notification error", error as Error);
      res.status(500).json({ message: "Failed to send dispatch notification" });
    }
  });
}
