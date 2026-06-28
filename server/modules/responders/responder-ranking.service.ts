import { db } from "../../db/db";
import { users, userReputation, disasterReports } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../utils/logger";

export interface RankedResponder {
  id: string;
  name: string;
  email: string;
  role: string;
  score: number;
  breakdown: {
    skillMatch: number;
    proximityScore: number;
    pastPerformance: number;
    fatiguePenalty: number;
  };
  distanceKm: number;
  skills: string[];
  reason: string;
}

export interface RankingResult {
  incidentId: string;
  recommendedResponders: RankedResponder[];
  algorithm: string;
  formula: string;
  rankedAt: string;
}

const DISASTER_SKILL_MAP: Record<string, string[]> = {
  fire:               ["fire_safety", "first_aid", "evacuation", "hazmat"],
  flood:              ["water_rescue", "evacuation", "first_aid", "swift_water"],
  earthquake:         ["search_rescue", "first_aid", "structural", "heavy_rescue"],
  road_accident:      ["first_aid", "trauma_care", "traffic_control", "extrication"],
  epidemic:           ["medical", "isolation", "sanitation", "contact_tracing"],
  landslide:          ["search_rescue", "heavy_equipment", "first_aid", "rope_rescue"],
  gas_leak:           ["hazmat", "evacuation", "first_aid", "gas_detection"],
  building_collapse:  ["search_rescue", "heavy_rescue", "first_aid", "structural"],
  storm:              ["evacuation", "first_aid", "shelter", "power_restoration"],
  chemical_spill:     ["hazmat", "decontamination", "first_aid", "evacuation"],
  water_contamination:["sanitation", "medical", "water_treatment", "first_aid"],
  power_outage:       ["electrical", "generator_ops", "evacuation", "first_aid"],
  default:            ["first_aid", "evacuation", "communications"],
};

// Simulated skill sets per responder role
function getSkillsForRole(role: string): string[] {
  const map: Record<string, string[]> = {
    volunteer: ["first_aid", "evacuation", "communications"],
    ngo:       ["first_aid", "evacuation", "shelter", "water_rescue", "medical"],
    admin:     ["search_rescue", "heavy_rescue", "structural", "first_aid", "evacuation", "hazmat"],
    authority: ["search_rescue", "first_aid", "evacuation", "trauma_care", "hazmat", "heavy_rescue"],
    government:["first_aid", "evacuation", "communications", "logistics"],
    citizen:   ["first_aid", "communications"],
  };
  return map[role] ?? map.citizen;
}

function computeSkillMatch(responderRole: string, requiredSkills: string[]): number {
  const responderSkills = getSkillsForRole(responderRole);
  const matched = requiredSkills.filter(s => responderSkills.includes(s));
  return matched.length / Math.max(requiredSkills.length, 1);
}

function computeProximityScore(distanceKm: number): number {
  if (distanceKm <= 1)  return 1.0;
  if (distanceKm <= 5)  return 0.85;
  if (distanceKm <= 10) return 0.65;
  if (distanceKm <= 25) return 0.40;
  if (distanceKm <= 50) return 0.20;
  return 0.05;
}

function computePersonalizedScore(
  skillMatch: number,
  proximityScore: number,
  pastPerformance: number,
  fatiguePenalty: number
): number {
  // Spec formula: 0.35 * skillMatch + 0.25 * proximity + 0.20 * performance - 0.20 * fatigue
  return Math.min(1, Math.max(0,
    0.35 * skillMatch +
    0.25 * proximityScore +
    0.20 * pastPerformance -
    0.20 * fatiguePenalty
  ));
}

export class ResponderRankingService {
  async rankForReport(reportId: string, maxResults = 5): Promise<RankingResult | null> {
    const [report] = await db.select().from(disasterReports)
      .where(eq(disasterReports.id, reportId));
    if (!report) return null;

    return this.rankForIncident(
      reportId,
      report.type,
      parseFloat(report.latitude ?? "19.076"),
      parseFloat(report.longitude ?? "72.877"),
      report.severity,
      maxResults
    );
  }

  async rankForIncident(
    incidentId: string,
    emergencyType: string,
    incidentLat: number,
    incidentLng: number,
    severity?: string,
    maxResults = 5
  ): Promise<RankingResult> {
    const responders = await db.select().from(users)
      .where(sql`${users.role} IN ('volunteer', 'ngo', 'admin', 'authority')`);

    const repMap = new Map<string, number>();
    const repData = await db.select().from(userReputation);
    repData.forEach(r => repMap.set(r.userId, r.trustScore));

    const requiredSkills = DISASTER_SKILL_MAP[emergencyType] ?? DISASTER_SKILL_MAP.default;

    const ranked: RankedResponder[] = [];

    for (const r of responders) {
      // Simulate distance (in production: use real coordinates from user profile)
      const distanceKm = parseFloat((1 + Math.random() * 35).toFixed(1));

      // Skip if too far for non-critical
      if (distanceKm > (severity === "critical" ? 50 : 25)) continue;

      const skillMatch      = computeSkillMatch(r.role ?? "citizen", requiredSkills);
      const proximityScore  = computeProximityScore(distanceKm);
      const repScore        = repMap.get(r.id) ?? 50;
      const pastPerformance = Math.min(1, repScore / 100);
      // Fatigue: simulated — in production track active assignments
      const fatiguePenalty  = parseFloat((Math.random() * 0.3).toFixed(3));
      const score           = computePersonalizedScore(skillMatch, proximityScore, pastPerformance, fatiguePenalty);

      const skills = getSkillsForRole(r.role ?? "citizen");
      const matchedSkills = requiredSkills.filter(s => skills.includes(s));

      const reasons: string[] = [];
      if (proximityScore >= 0.8)   reasons.push(`${distanceKm}km away`);
      if (skillMatch >= 0.7)       reasons.push(`strong skill match (${matchedSkills.slice(0, 2).join(", ")})`);
      if (pastPerformance >= 0.8)  reasons.push(`${Math.round(pastPerformance * 100)}% success rate`);
      if (fatiguePenalty < 0.1)    reasons.push("fully available");
      if (reasons.length === 0)    reasons.push("available responder");

      ranked.push({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role ?? "volunteer",
        score: parseFloat(score.toFixed(3)),
        breakdown: {
          skillMatch: parseFloat(skillMatch.toFixed(3)),
          proximityScore: parseFloat(proximityScore.toFixed(3)),
          pastPerformance: parseFloat(pastPerformance.toFixed(3)),
          fatiguePenalty: parseFloat(fatiguePenalty.toFixed(3)),
        },
        distanceKm,
        skills: matchedSkills,
        reason: reasons.join(" + "),
      });
    }

    ranked.sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, maxResults);

    logger.info("[ResponderRanking] Ranked responders", {
      incidentId, emergencyType, totalCandidates: ranked.length, returned: top.length,
    });

    return {
      incidentId,
      recommendedResponders: top,
      algorithm: "Personalized Response Scoring v2",
      formula: "score = 0.35×skillMatch + 0.25×proximity + 0.20×performance − 0.20×fatigue",
      rankedAt: new Date().toISOString(),
    };
  }
}

export const responderRanking = new ResponderRankingService();
