import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { deviceFingerprintService } from "../modules/security/device-fingerprint.service";
import { logger } from "../utils/logger";

export function registerDeviceSecurityRoutes(app: Express) {
  app.get("/api/security/devices/flagged", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const flagged = await deviceFingerprintService.getFlaggedDevices();
      res.json({ flagged, total: flagged.length });
    } catch (error) {
      logger.error("Get flagged devices error", error as Error);
      res.status(500).json({ message: "Failed to get flagged devices" });
    }
  });

  app.get("/api/security/devices/high-risk", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const minRisk = req.query.minRisk !== undefined ? parseInt(req.query.minRisk as string) : 60;
      const devices = await deviceFingerprintService.getHighRiskDevices(minRisk);
      res.json({ devices, total: devices.length, minRisk });
    } catch (error) {
      logger.error("Get high-risk devices error", error as Error);
      res.status(500).json({ message: "Failed to get high-risk devices" });
    }
  });

  app.get("/api/security/devices/user/:userId", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const devices = await deviceFingerprintService.getByUser(req.params.userId);
      res.json({ devices, total: devices.length });
    } catch (error) {
      logger.error("Get user devices error", error as Error);
      res.status(500).json({ message: "Failed to get user devices" });
    }
  });
}
