import { db } from "../../db/db";
import { incidents, incidentReports, disasterReports } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "../../utils/logger";

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function semanticSimilarity(text1: string, text2: string): number {
  const tokenize = (t: string) =>
    t.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 2);

  const tokens1 = new Set(tokenize(text1));
  const tokens2 = new Set(tokenize(text2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) intersection++;
  }

  const union = tokens1.size + tokens2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface AggregationResult {
  action: "merged" | "created";
  incidentId: string;
  reportId: string;
  existingIncidentId?: string;
  cluster?: {
    geoDist: number;
    semanticSim: number;
  };
}

export class EventAggregationService {
  private readonly GEO_THRESHOLD_M = 500;
  private readonly SEMANTIC_THRESHOLD = 0.20;
  private readonly CLUSTER_WINDOW_MS = 3 * 60 * 60 * 1000;

  async aggregateReport(reportId: string): Promise<AggregationResult> {
    try {
      const [report] = await db.select().from(disasterReports)
        .where(eq(disasterReports.id, reportId));

      if (!report) throw new Error(`Report ${reportId} not found`);

      const windowStart = new Date(Date.now() - this.CLUSTER_WINDOW_MS);
      const activeIncidents = await db.select().from(incidents)
        .where(and(
          eq(incidents.status, "active"),
          gte(incidents.createdAt, windowStart)
        ));

      let bestMatch: {
        incidentId: string;
        geoDist: number;
        semanticSim: number;
      } | null = null;

      for (const incident of activeIncidents) {
        if (incident.disasterType !== report.type) continue;

        const geoDist =
          report.latitude && report.longitude && incident.centroidLat && incident.centroidLon
            ? haversineMeters(
                parseFloat(report.latitude), parseFloat(report.longitude),
                parseFloat(incident.centroidLat), parseFloat(incident.centroidLon)
              )
            : Infinity;

        if (geoDist > this.GEO_THRESHOLD_M) continue;

        const semanticSim = semanticSimilarity(
          `${report.title} ${report.description}`,
          incident.title || ""
        );

        if (semanticSim >= this.SEMANTIC_THRESHOLD) {
          if (!bestMatch || geoDist < bestMatch.geoDist) {
            bestMatch = { incidentId: incident.id, geoDist, semanticSim };
          }
        }
      }

      if (bestMatch) {
        await db.insert(incidentReports).values({
          incidentId: bestMatch.incidentId,
          reportId: report.id,
          mergedAt: new Date(),
        });

        await db.update(incidents)
          .set({
            reportCount: sql`${incidents.reportCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(incidents.id, bestMatch.incidentId));

        logger.info("Report merged into existing incident", {
          reportId,
          incidentId: bestMatch.incidentId,
          geoDist: bestMatch.geoDist.toFixed(0) + "m",
          semanticSim: bestMatch.semanticSim.toFixed(2),
        });

        return {
          action: "merged",
          incidentId: bestMatch.incidentId,
          reportId,
          existingIncidentId: bestMatch.incidentId,
          cluster: {
            geoDist: Math.round(bestMatch.geoDist),
            semanticSim: Math.round(bestMatch.semanticSim * 100) / 100,
          },
        };
      }

      const [newIncident] = await db.insert(incidents).values({
        title: report.title,
        description: report.description,
        disasterType: report.type,
        severity: report.severity,
        status: "active",
        centroidLat: report.latitude || null,
        centroidLon: report.longitude || null,
        location: report.location,
        reportCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      await db.insert(incidentReports).values({
        incidentId: newIncident.id,
        reportId: report.id,
        mergedAt: new Date(),
      });

      logger.info("New incident created from report", {
        reportId,
        incidentId: newIncident.id,
      });

      return {
        action: "created",
        incidentId: newIncident.id,
        reportId,
      };
    } catch (error) {
      logger.error("Event aggregation error", error as Error);
      throw error;
    }
  }

  async getActiveIncidents() {
    try {
      return await db.select().from(incidents)
        .where(eq(incidents.status, "active"))
        .orderBy(sql`${incidents.updatedAt} DESC`);
    } catch (error) {
      logger.error("Get active incidents error", error as Error);
      return [];
    }
  }

  async getIncidentReports(incidentId: string) {
    try {
      return await db.select({
        link: incidentReports,
        report: disasterReports,
      })
        .from(incidentReports)
        .innerJoin(disasterReports, eq(incidentReports.reportId, disasterReports.id))
        .where(eq(incidentReports.incidentId, incidentId));
    } catch (error) {
      logger.error("Get incident reports error", error as Error);
      return [];
    }
  }

  async mergeIncidents(sourceId: string, targetId: string): Promise<void> {
    await db.update(incidentReports)
      .set({ incidentId: targetId })
      .where(eq(incidentReports.incidentId, sourceId));

    const [source] = await db.select().from(incidents).where(eq(incidents.id, sourceId));

    if (source) {
      await db.update(incidents)
        .set({
          reportCount: sql`${incidents.reportCount} + ${source.reportCount}`,
          updatedAt: new Date(),
        })
        .where(eq(incidents.id, targetId));
    }

    await db.update(incidents)
      .set({ status: "merged" as any, updatedAt: new Date() })
      .where(eq(incidents.id, sourceId));

    logger.info("Incidents merged", { sourceId, targetId });
  }
}

export const eventAggregationService = new EventAggregationService();
