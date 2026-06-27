import { db } from "../../db/db";
import { disasterReports, users, sosAlerts } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { logger } from "../../utils/logger";

export interface GraphNode {
  id: string;
  type: "incident" | "user" | "responder" | "location";
  label: string;
  severity?: string;
  meta?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: "REPORTED" | "RESPONDING" | "NEARBY" | "ESCALATED_TO";
}

export interface IncidentGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    reportCount: number;
    responderCount: number;
    nearbyCount: number;
  };
}

export class IncidentGraphService {
  async buildGraph(reportId: string): Promise<IncidentGraph> {
    try {
      const report = await db
        .select()
        .from(disasterReports)
        .where(eq(disasterReports.id, reportId))
        .limit(1)
        .then((r) => r[0]);

      if (!report) {
        return { nodes: [], edges: [], stats: { reportCount: 0, responderCount: 0, nearbyCount: 0 } };
      }

      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];

      nodes.push({
        id: `incident-${report.id}`,
        type: "incident",
        label: report.title || `${report.type} Report`,
        severity: report.severity,
        meta: { type: report.type, status: report.status, location: report.location },
      });

      if (report.userId) {
        const reporter = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, report.userId))
          .limit(1)
          .then((r) => r[0]);

        if (reporter) {
          nodes.push({
            id: `user-${reporter.id}`,
            type: "user",
            label: reporter.name || "Anonymous",
          });
          edges.push({
            source: `user-${reporter.id}`,
            target: `incident-${report.id}`,
            relation: "REPORTED",
          });
        }
      }

      const similarIds: string[] = (report.similarReportIds as string[]) || [];
      if (similarIds.length > 0) {
        const similar = await db
          .select({ id: disasterReports.id, title: disasterReports.title, severity: disasterReports.severity, type: disasterReports.type })
          .from(disasterReports)
          .where(inArray(disasterReports.id, similarIds.slice(0, 4)));

        for (const s of similar) {
          nodes.push({
            id: `incident-${s.id}`,
            type: "incident",
            label: s.title || `${s.type} Report`,
            severity: s.severity,
          });
          edges.push({
            source: `incident-${s.id}`,
            target: `incident-${report.id}`,
            relation: "NEARBY",
          });
        }
      }

      const relatedSOS = await db
        .select({ id: sosAlerts.id, emergencyType: sosAlerts.emergencyType, respondedBy: sosAlerts.respondedBy })
        .from(sosAlerts)
        .where(eq(sosAlerts.status, "responding"))
        .limit(3);

      for (const sos of relatedSOS) {
        if (sos.respondedBy) {
          const respNodeId = `responder-${sos.id}`;
          nodes.push({
            id: respNodeId,
            type: "responder",
            label: `${sos.emergencyType ?? "Emergency"} Team`,
            meta: { sosId: sos.id },
          });
          edges.push({
            source: respNodeId,
            target: `incident-${report.id}`,
            relation: "RESPONDING",
          });
        }
      }

      if (report.location) {
        nodes.push({
          id: `location-${report.id}`,
          type: "location",
          label: report.location,
        });
        edges.push({
          source: `location-${report.id}`,
          target: `incident-${report.id}`,
          relation: "ESCALATED_TO",
        });
      }

      return {
        nodes,
        edges,
        stats: {
          reportCount: 1 + similarIds.length,
          responderCount: relatedSOS.filter((s) => s.respondedBy).length,
          nearbyCount: similarIds.length,
        },
      };
    } catch (err) {
      logger.error("[IncidentGraph] Failed to build graph", err as Error, { reportId });
      return { nodes: [], edges: [], stats: { reportCount: 0, responderCount: 0, nearbyCount: 0 } };
    }
  }
}

export const incidentGraphService = new IncidentGraphService();
