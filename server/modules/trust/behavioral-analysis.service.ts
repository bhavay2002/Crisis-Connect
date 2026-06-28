import { db } from "../../db/db";
import { disasterReports, users, userReputation } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { logger } from "../../utils/logger";

export interface BehavioralProfile {
  userId: string;
  submissionRate: number;
  avgTimeBetweenReports: number;
  locationConsistency: number;
  severityDistribution: Record<string, number>;
  falseReportRate: number;
  anomalyScore: number;
  anomalyFlags: string[];
  trustBadge: "unverified" | "trusted" | "verified_responder" | "elite_responder";
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface AnomalyAlert {
  detected: boolean;
  type: string;
  description: string;
  affectedArea?: string;
  reportCount: number;
  timeWindowMinutes: number;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class BehavioralAnalysisService {
  async analyzeUser(userId: string): Promise<BehavioralProfile> {
    try {
      const userReports = await db
        .select()
        .from(disasterReports)
        .where(eq(disasterReports.userId, userId))
        .orderBy(desc(disasterReports.createdAt));

      const reputation = await db
        .select()
        .from(userReputation)
        .where(eq(userReputation.userId, userId));

      const rep = reputation[0];
      const anomalyFlags: string[] = [];
      let anomalyScore = 0;

      const now = Date.now();
      const last24h = userReports.filter(r =>
        now - new Date(r.createdAt).getTime() < 86_400_000
      );
      const submissionRate = last24h.length;

      if (submissionRate > 10) {
        anomalyScore += 40;
        anomalyFlags.push("excessive_submissions_24h");
      } else if (submissionRate > 5) {
        anomalyScore += 20;
        anomalyFlags.push("high_submission_rate");
      }

      let avgTimeBetween = 0;
      if (userReports.length > 1) {
        const sorted = [...userReports].sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const diffs = sorted.slice(1).map((r, i) =>
          new Date(r.createdAt).getTime() - new Date(sorted[i].createdAt).getTime()
        );
        avgTimeBetween = diffs.reduce((a, b) => a + b, 0) / diffs.length / 60_000;
        if (avgTimeBetween < 2) {
          anomalyScore += 30;
          anomalyFlags.push("reports_too_frequent");
        }
      }

      let locationConsistency = 100;
      if (userReports.length > 1) {
        const withGps = userReports.filter(r => r.latitude && r.longitude);
        if (withGps.length > 1) {
          const distances: number[] = [];
          for (let i = 1; i < withGps.length; i++) {
            const d = haversineKm(
              parseFloat(withGps[i - 1].latitude!),
              parseFloat(withGps[i - 1].longitude!),
              parseFloat(withGps[i].latitude!),
              parseFloat(withGps[i].longitude!)
            );
            distances.push(d);
          }
          const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
          locationConsistency = Math.max(0, 100 - avgDist * 2);
          if (avgDist > 200) {
            anomalyScore += 25;
            anomalyFlags.push("extreme_location_variance");
          }
        }
      }

      const severityDistribution: Record<string, number> = {};
      userReports.forEach(r => {
        severityDistribution[r.severity] = (severityDistribution[r.severity] || 0) + 1;
      });

      const criticalCount = severityDistribution["critical"] || 0;
      if (userReports.length > 0 && criticalCount / userReports.length > 0.7) {
        anomalyScore += 20;
        anomalyFlags.push("disproportionate_critical_reports");
      }

      const falseReportRate = rep
        ? rep.totalReports > 0 ? rep.falseReports / rep.totalReports : 0
        : 0;

      if (falseReportRate > 0.3) {
        anomalyScore += 35;
        anomalyFlags.push("high_false_report_rate");
      }

      const trustScore = rep?.trustScore || 50;
      const verifiedReports = rep?.verifiedReports || 0;
      const totalReports = rep?.totalReports || 0;

      let trustBadge: BehavioralProfile["trustBadge"] = "unverified";
      if (trustScore >= 90 && verifiedReports >= 20) trustBadge = "elite_responder";
      else if (trustScore >= 75 && verifiedReports >= 10) trustBadge = "verified_responder";
      else if (trustScore >= 60 && totalReports >= 3) trustBadge = "trusted";

      const riskLevel: BehavioralProfile["riskLevel"] =
        anomalyScore >= 70 ? "critical" :
        anomalyScore >= 50 ? "high" :
        anomalyScore >= 25 ? "medium" : "low";

      return {
        userId,
        submissionRate,
        avgTimeBetweenReports: Math.round(avgTimeBetween),
        locationConsistency: Math.round(locationConsistency),
        severityDistribution,
        falseReportRate: Math.round(falseReportRate * 100) / 100,
        anomalyScore: Math.min(100, anomalyScore),
        anomalyFlags,
        trustBadge,
        riskLevel,
      };
    } catch (error) {
      logger.error("Behavioral analysis error", error as Error);
      return {
        userId,
        submissionRate: 0,
        avgTimeBetweenReports: 0,
        locationConsistency: 100,
        severityDistribution: {},
        falseReportRate: 0,
        anomalyScore: 0,
        anomalyFlags: [],
        trustBadge: "unverified",
        riskLevel: "low",
      };
    }
  }

  async detectSystemAnomalies(): Promise<AnomalyAlert[]> {
    try {
      const alerts: AnomalyAlert[] = [];
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const recentReports = await db
        .select()
        .from(disasterReports)
        .where(sql`${disasterReports.createdAt} > ${thirtyMinAgo}`);

      if (recentReports.length > 20) {
        alerts.push({
          detected: true,
          type: "submission_spike",
          description: `${recentReports.length} reports in 30 minutes — potential coordinated fake reporting or genuine crisis`,
          reportCount: recentReports.length,
          timeWindowMinutes: 30,
        });
      }

      const typeCounts: Record<string, { count: number; locations: string[] }> = {};
      recentReports.forEach(r => {
        if (!typeCounts[r.type]) typeCounts[r.type] = { count: 0, locations: [] };
        typeCounts[r.type].count++;
        if (r.location) typeCounts[r.type].locations.push(r.location);
      });

      for (const [type, data] of Object.entries(typeCounts)) {
        if (data.count >= 5) {
          alerts.push({
            detected: true,
            type: "clustered_disaster_type",
            description: `${data.count} ${type} reports in 30 minutes — early warning pattern`,
            affectedArea: data.locations[0],
            reportCount: data.count,
            timeWindowMinutes: 30,
          });
        }
      }

      return alerts;
    } catch (error) {
      logger.error("System anomaly detection error", error as Error);
      return [];
    }
  }
}

export const behavioralAnalysisService = new BehavioralAnalysisService();
