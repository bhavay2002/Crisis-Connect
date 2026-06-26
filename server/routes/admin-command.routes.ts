import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { db } from "../db/db";
import { disasterReports, sosAlerts, incidentLogs, users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { storage } from "../db/storage";
import { eventAggregationService } from "../modules/ai/event-aggregation.service";
import { logger } from "../utils/logger";

const adminOnly = [isAuthenticated, requireRole("admin")];

export function registerAdminCommandRoutes(app: Express) {

  app.patch("/api/admin/incident/:id/override", ...adminOnly, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { newType, newSeverity, newStatus, reason, notes } = req.body;
      const adminId = req.user.userId;

      const report = await storage.getDisasterReport(id);
      if (!report) return res.status(404).json({ message: "Report not found" });

      const updateData: Record<string, any> = {
        updatedAt: new Date(),
        adminNotes: notes || `Override by admin ${adminId}: ${reason}`,
      };
      if (newType) updateData.type = newType;
      if (newSeverity) updateData.severity = newSeverity;
      if (newStatus) updateData.status = newStatus;

      await db.update(disasterReports)
        .set(updateData)
        .where(eq(disasterReports.id, id));

      await db.insert(incidentLogs).values({
        entityId: id,
        entityType: "report",
        fromState: report.status,
        toState: newStatus || report.status,
        triggeredBy: adminId,
        reason: reason || "Admin override",
        metadata: { newType, newSeverity, notes },
        timestamp: new Date(),
      });

      logger.info("Admin override applied", { reportId: id, adminId, newType, newSeverity, newStatus });
      res.json({ message: "Override applied", reportId: id, changes: updateData });
    } catch (error) {
      logger.error("Admin override error", error as Error);
      res.status(500).json({ message: "Override failed" });
    }
  });

  app.post("/api/admin/incident/:id/assign", ...adminOnly, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { assigneeId, reason } = req.body;
      const adminId = req.user.userId;

      if (!assigneeId) return res.status(400).json({ message: "assigneeId required" });

      const [assignee] = await db.select().from(users).where(eq(users.id, assigneeId));
      if (!assignee) return res.status(404).json({ message: "Assignee not found" });

      const report = await storage.getDisasterReport(id);
      if (!report) return res.status(404).json({ message: "Report not found" });

      await db.update(disasterReports)
        .set({
          assignedTo: assigneeId,
          assignedAt: new Date(),
          status: "responding",
          updatedAt: new Date(),
        })
        .where(eq(disasterReports.id, id));

      await db.insert(incidentLogs).values({
        entityId: id,
        entityType: "report",
        fromState: report.status,
        toState: "responding",
        triggeredBy: adminId,
        reason: reason || `Manual assignment to ${assignee.name}`,
        metadata: { assigneeId, assigneeName: assignee.name, assigneeRole: assignee.role },
        timestamp: new Date(),
      });

      logger.info("Incident manually assigned", { reportId: id, assigneeId, adminId });
      res.json({
        message: "Assigned successfully",
        reportId: id,
        assignedTo: { id: assignee.id, name: assignee.name, role: assignee.role },
      });
    } catch (error) {
      logger.error("Admin assign error", error as Error);
      res.status(500).json({ message: "Assignment failed" });
    }
  });

  app.post("/api/admin/incident/:id/escalate", ...adminOnly, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason, level } = req.body;
      const adminId = req.user.userId;

      const report = await storage.getDisasterReport(id);
      if (!report) {
        const [sos] = await db.select().from(sosAlerts).where(eq(sosAlerts.id, id));
        if (!sos) return res.status(404).json({ message: "Incident not found" });

        await db.update(sosAlerts)
          .set({ severity: "critical", updatedAt: new Date() })
          .where(eq(sosAlerts.id, id));

        await db.insert(incidentLogs).values({
          entityId: id,
          entityType: "sos",
          fromState: sos.status,
          toState: sos.status,
          triggeredBy: adminId,
          reason: reason || "Manual admin escalation",
          metadata: { escalationLevel: level || 3 },
          timestamp: new Date(),
        });

        return res.json({ message: "SOS escalated to critical", sosId: id });
      }

      await db.update(disasterReports)
        .set({ severity: "critical", priorityScore: 100, updatedAt: new Date() })
        .where(eq(disasterReports.id, id));

      await db.insert(incidentLogs).values({
        entityId: id,
        entityType: "report",
        fromState: report.severity,
        toState: "critical",
        triggeredBy: adminId,
        reason: reason || "Manual admin force-escalation",
        metadata: { escalationLevel: level || 3, previousSeverity: report.severity },
        timestamp: new Date(),
      });

      logger.warn("Admin force-escalated incident", { reportId: id, adminId, level });
      res.json({ message: "Incident escalated to critical", reportId: id });
    } catch (error) {
      logger.error("Admin escalate error", error as Error);
      res.status(500).json({ message: "Escalation failed" });
    }
  });

  app.post("/api/admin/incident/merge", ...adminOnly, async (req: any, res) => {
    try {
      const { sourceIncidentId, targetIncidentId, reason } = req.body;
      const adminId = req.user.userId;

      if (!sourceIncidentId || !targetIncidentId) {
        return res.status(400).json({ message: "sourceIncidentId and targetIncidentId required" });
      }

      await eventAggregationService.mergeIncidents(sourceIncidentId, targetIncidentId);

      await db.insert(incidentLogs).values({
        entityId: targetIncidentId,
        entityType: "incident",
        fromState: "active",
        toState: "merged",
        triggeredBy: adminId,
        reason: reason || `Admin merged ${sourceIncidentId} into ${targetIncidentId}`,
        metadata: { sourceIncidentId },
        timestamp: new Date(),
      });

      logger.info("Admin merged incidents", { sourceIncidentId, targetIncidentId, adminId });
      res.json({ message: "Incidents merged", targetIncidentId, sourceIncidentId });
    } catch (error) {
      logger.error("Admin merge error", error as Error);
      res.status(500).json({ message: "Merge failed" });
    }
  });

  app.post("/api/admin/incidents/aggregate/:reportId", ...adminOnly, async (req: any, res) => {
    try {
      const { reportId } = req.params;
      const result = await eventAggregationService.aggregateReport(reportId);
      res.json(result);
    } catch (error) {
      logger.error("Manual aggregation error", error as Error);
      res.status(500).json({ message: "Aggregation failed", detail: (error as Error).message });
    }
  });

  app.get("/api/admin/incidents", ...adminOnly, async (req: any, res) => {
    try {
      const activeIncidents = await eventAggregationService.getActiveIncidents();
      res.json({ incidents: activeIncidents, total: activeIncidents.length });
    } catch (error) {
      logger.error("Get admin incidents error", error as Error);
      res.status(500).json({ message: "Failed to fetch incidents" });
    }
  });

  app.get("/api/admin/incidents/:id/reports", ...adminOnly, async (req: any, res) => {
    try {
      const { id } = req.params;
      const linked = await eventAggregationService.getIncidentReports(id);
      res.json({ incidentId: id, reports: linked, total: linked.length });
    } catch (error) {
      logger.error("Get incident reports error", error as Error);
      res.status(500).json({ message: "Failed to fetch incident reports" });
    }
  });

  app.get("/api/admin/incident/:id/history", isAuthenticated, requireRole("admin", "ngo", "government"), async (req: any, res) => {
    try {
      const { id } = req.params;
      const logs = await db.select().from(incidentLogs)
        .where(eq(incidentLogs.entityId, id))
        .orderBy(sql`${incidentLogs.timestamp} ASC`);

      res.json({
        entityId: id,
        transitions: logs,
        total: logs.length,
      });
    } catch (error) {
      logger.error("Incident history error", error as Error);
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });
}
