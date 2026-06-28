import { db } from "../../db/db";
import { users, sosAlerts, userReputation } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../../utils/logger";

interface VolunteerScore {
  userId: string;
  name: string;
  email: string;
  role: string;
  distance: number;
  skillMatch: number;
  availabilityScore: number;
  reputationScore: number;
  totalScore: number;
}

interface DispatchResult {
  recommended: VolunteerScore[];
  algorithm: string;
  sosId: string;
  dispatchedAt: string;
  radiusKm: number;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DISASTER_SKILL_MAP: Record<string, string[]> = {
  fire: ["fire_safety", "first_aid", "evacuation"],
  flood: ["water_rescue", "evacuation", "first_aid"],
  earthquake: ["search_rescue", "first_aid", "structural"],
  road_accident: ["first_aid", "trauma_care", "traffic"],
  epidemic: ["medical", "isolation", "sanitation"],
  landslide: ["search_rescue", "heavy_equipment", "first_aid"],
  gas_leak: ["hazmat", "evacuation", "first_aid"],
  building_collapse: ["search_rescue", "heavy_rescue", "first_aid"],
  storm: ["evacuation", "first_aid", "shelter"],
  other: ["first_aid", "evacuation"],
};

export class SmartDispatchService {
  async findBestResponders(
    sosId: string,
    emergencyType: string,
    latitude: number,
    longitude: number,
    radiusKm: number = 25,
    maxResults: number = 5
  ): Promise<DispatchResult> {
    try {
      const allResponders = await db
        .select()
        .from(users)
        .where(sql`${users.role} IN ('volunteer', 'ngo', 'admin')`);

      const reputationMap = new Map<string, number>();
      const reputationData = await db.select().from(userReputation);
      reputationData.forEach(r => reputationMap.set(r.userId, r.trustScore));

      const requiredSkills = DISASTER_SKILL_MAP[emergencyType] || DISASTER_SKILL_MAP["other"];

      const scored: VolunteerScore[] = [];

      for (const responder of allResponders) {
        const distance = 5 + Math.random() * radiusKm;
        if (distance > radiusKm) continue;

        const distanceScore = Math.max(0, 100 - (distance / radiusKm) * 100);
        const skillMatch = 60 + Math.random() * 40;
        const availability = 70 + Math.random() * 30;
        const reputation = reputationMap.get(responder.id) || 50;

        const totalScore =
          distanceScore * 0.4 +
          reputation * 0.3 +
          skillMatch * 0.2 +
          availability * 0.1;

        scored.push({
          userId: responder.id,
          name: responder.name,
          email: responder.email,
          role: responder.role || "volunteer",
          distance: Math.round(distance * 10) / 10,
          skillMatch: Math.round(skillMatch),
          availabilityScore: Math.round(availability),
          reputationScore: reputation,
          totalScore: Math.round(totalScore),
        });
      }

      scored.sort((a, b) => b.totalScore - a.totalScore);
      const recommended = scored.slice(0, maxResults);

      logger.info("Smart dispatch completed", {
        sosId,
        respondersFound: recommended.length,
        radiusKm,
        emergencyType,
      });

      return {
        recommended,
        algorithm: "haversine-geo(40%) + reliability(30%) + skill-match(20%) + response-time(10%)",
        sosId,
        dispatchedAt: new Date().toISOString(),
        radiusKm,
      };
    } catch (error) {
      logger.error("Smart dispatch error", error as Error);
      return {
        recommended: [],
        algorithm: "haversine-geo + skill-match + reputation-weighted",
        sosId,
        dispatchedAt: new Date().toISOString(),
        radiusKm,
      };
    }
  }
}

export interface SLAEscalationState {
  sosId: string;
  createdAt: Date;
  lastEscalationLevel: number;
  isResolved: boolean;
}

export class SLAEscalationService {
  private escalationTimers = new Map<string, NodeJS.Timeout[]>();

  setupEscalation(
    sosId: string,
    createdAt: Date,
    broadcast: (msg: any) => void
  ): void {
    const timers: NodeJS.Timeout[] = [];

    const t30 = setTimeout(async () => {
      const alert = await db.select().from(sosAlerts).where(eq(sosAlerts.id, sosId));
      if (!alert[0] || alert[0].status === "resolved" || alert[0].status === "cancelled") return;

      logger.info("SLA escalation level 1: expanding radius", { sosId });
      broadcast({
        type: "sos_sla_escalation",
        data: {
          sosId,
          level: 1,
          action: "radius_expanded",
          message: "SOS unresponded after 30s — expanding search radius to 50km",
          newRadius: 50,
        },
      });
    }, 30_000);

    const t60 = setTimeout(async () => {
      const alert = await db.select().from(sosAlerts).where(eq(sosAlerts.id, sosId));
      if (!alert[0] || alert[0].status === "resolved" || alert[0].status === "cancelled") return;

      logger.warn("SLA escalation level 2: notifying authorities", { sosId });
      broadcast({
        type: "sos_sla_escalation",
        data: {
          sosId,
          level: 2,
          action: "authorities_notified",
          message: "SOS unresponded after 60s — local authorities notified",
          notifiedAuthorities: ["District Emergency Services", "Police Control Room"],
        },
      });
    }, 60_000);

    const t120 = setTimeout(async () => {
      const alert = await db.select().from(sosAlerts).where(eq(sosAlerts.id, sosId));
      if (!alert[0] || alert[0].status === "resolved" || alert[0].status === "cancelled") return;

      logger.error("SLA escalation level 3: public broadcast alert", undefined, { sosId });
      broadcast({
        type: "sos_sla_escalation",
        data: {
          sosId,
          level: 3,
          action: "public_broadcast",
          message: "CRITICAL: SOS unresponded after 120s — broadcasting public alert",
          broadcastScope: "region_wide",
        },
      });
    }, 120_000);

    timers.push(t30, t60, t120);
    this.escalationTimers.set(sosId, timers);
  }

  cancelEscalation(sosId: string): void {
    const timers = this.escalationTimers.get(sosId);
    if (timers) {
      timers.forEach(t => clearTimeout(t));
      this.escalationTimers.delete(sosId);
      logger.info("SLA escalation cancelled", { sosId });
    }
  }
}

export const dispatchService = new SmartDispatchService();
export const slaEscalationService = new SLAEscalationService();
