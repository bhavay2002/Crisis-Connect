import { db } from "../../db/db";
import { disasterReports, userReputation } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "../../utils/logger";
import type { MultiSignalAnalysisResult } from "./crisis-intelligence.service";
import { adaptiveWeights } from "../fusion/adaptive-weights.service";
import { featureStore } from "../fusion/feature-store.service";

export interface FusedScore {
  finalScore: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  components: {
    aiUrgency: number;
    locationRisk: number;
    repetitionScore: number;
    userTrustScore: number;
  };
  weights: {
    aiUrgency: number;
    locationRisk: number;
    repetitionScore: number;
    userTrustScore: number;
  };
  reasoning: string;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class SignalFusionService {
  // ── Static fallback (used when adaptive model unavailable) ──────────────────
  private readonly STATIC_WEIGHTS = {
    aiUrgency:      0.5,
    locationRisk:   0.2,
    repetitionScore:0.2,
    userTrustScore: 0.1,
  };

  async computeFusedScore(
    aiResult: MultiSignalAnalysisResult,
    input: {
      latitude?: string;
      longitude?: string;
      userId?: string;
      type: string;
      reportId?: string;   // optional — if provided, features are saved to feature store
    }
  ): Promise<FusedScore> {
    const [locationRisk, repetitionScore, userTrustScore] = await Promise.all([
      this.computeLocationRisk(input.latitude, input.longitude),
      this.computeRepetitionScore(input.type, input.latitude, input.longitude),
      this.computeUserTrustScore(input.userId),
    ]);

    const aiUrgency = aiResult.urgencyScore.score / 10;

    // ── §22 Adaptive Weights — use learned model if ready ────────────────────
    let activeWeights = this.STATIC_WEIGHTS;
    let modelVersion  = "v0-static";
    let isAdaptive    = false;

    if (adaptiveWeights.isReady()) {
      const learned = adaptiveWeights.getWeights();
      activeWeights = {
        aiUrgency:       learned.aiScore,
        locationRisk:    learned.locationRisk,
        repetitionScore: learned.repetitionScore,
        userTrustScore:  learned.userTrust,
      };
      modelVersion = learned.version;
      isAdaptive   = true;
    }

    const finalScore =
      activeWeights.aiUrgency       * aiUrgency +
      activeWeights.locationRisk     * locationRisk +
      activeWeights.repetitionScore  * repetitionScore +
      activeWeights.userTrustScore   * userTrustScore;

    const normalized = Math.min(1, Math.max(0, finalScore));

    const priority: FusedScore["priority"] =
      normalized >= 0.8 ? "CRITICAL" :
      normalized >= 0.6 ? "HIGH" :
      normalized >= 0.35 ? "MEDIUM" : "LOW";

    const reasons: string[] = [];
    if (aiUrgency >= 0.7) reasons.push(`high AI urgency (${(aiUrgency * 10).toFixed(1)}/10)`);
    if (locationRisk >= 0.5) reasons.push(`elevated location risk (${(locationRisk * 100).toFixed(0)}%)`);
    if (repetitionScore >= 0.5) reasons.push(`repeated reports in area (score ${(repetitionScore * 100).toFixed(0)}%)`);
    if (userTrustScore < 0.4) reasons.push("low user trust weight applied");
    if (isAdaptive) reasons.push(`adaptive weights ${modelVersion}`);

    logger.info("Signal fusion computed", {
      finalScore:   normalized.toFixed(3),
      priority,
      aiUrgency,
      locationRisk,
      repetitionScore,
      userTrustScore,
      modelVersion,
      isAdaptive,
    });

    // ── §22 Feature Store — persist vector for later training ─────────────────
    if (input.reportId) {
      featureStore.save(
        input.reportId,
        { aiScore: aiUrgency, locationRisk, repetitionScore, userTrust: userTrustScore, weatherScore: 0, socialScore: 0 },
        normalized,
        modelVersion,
      ).catch(() => {});  // fire-and-forget
    }

    return {
      finalScore: Math.round(normalized * 1000) / 1000,
      priority,
      components: {
        aiUrgency:       Math.round(aiUrgency * 1000) / 1000,
        locationRisk:    Math.round(locationRisk * 1000) / 1000,
        repetitionScore: Math.round(repetitionScore * 1000) / 1000,
        userTrustScore:  Math.round(userTrustScore * 1000) / 1000,
      },
      weights: activeWeights,
      reasoning: reasons.length
        ? `Priority ${priority} due to: ${reasons.join("; ")}.`
        : `Normal priority — no elevated signals detected.`,
    };
  }

  private async computeLocationRisk(lat?: string, lon?: string): Promise<number> {
    if (!lat || !lon) return 0.3;

    try {
      const centerLat = parseFloat(lat);
      const centerLon = parseFloat(lon);
      if (isNaN(centerLat) || isNaN(centerLon)) return 0.3;

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const nearby = await db.select().from(disasterReports)
        .where(gte(disasterReports.createdAt, since));

      let riskScore = 0;
      let count = 0;

      for (const r of nearby) {
        if (!r.latitude || !r.longitude) continue;
        const dist = haversineDistance(centerLat, centerLon, parseFloat(r.latitude), parseFloat(r.longitude));
        if (dist > 5000) continue;

        const weight =
          r.severity === "critical" ? 1.0 :
          r.severity === "high" ? 0.7 :
          r.severity === "medium" ? 0.4 : 0.2;

        const distanceDecay = Math.max(0, 1 - dist / 5000);
        riskScore += weight * distanceDecay;
        count++;
      }

      if (count === 0) return 0.1;
      return Math.min(1, riskScore / Math.max(count, 3));
    } catch (error) {
      logger.error("Location risk computation error", error as Error);
      return 0.3;
    }
  }

  private async computeRepetitionScore(type: string, lat?: string, lon?: string): Promise<number> {
    if (!lat || !lon) return 0.1;

    try {
      const centerLat = parseFloat(lat);
      const centerLon = parseFloat(lon);
      if (isNaN(centerLat) || isNaN(centerLon)) return 0.1;

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentSameType = await db.select().from(disasterReports)
        .where(and(
          eq(disasterReports.type, type as any),
          gte(disasterReports.createdAt, oneHourAgo)
        ));

      let nearbyCount = 0;
      for (const r of recentSameType) {
        if (!r.latitude || !r.longitude) continue;
        const dist = haversineDistance(centerLat, centerLon, parseFloat(r.latitude), parseFloat(r.longitude));
        if (dist <= 500) nearbyCount++;
      }

      return Math.min(1, nearbyCount / 5);
    } catch (error) {
      logger.error("Repetition score computation error", error as Error);
      return 0.1;
    }
  }

  /**
   * Compute the full feature vector for a report without requiring a MultiSignalAnalysisResult.
   * Used by the AI worker to save features to the feature store after async AI validation.
   */
  async computeFeatureVector(
    aiScore: number,    // 0–1 (normalized from AIValidationService score/100)
    input: {
      latitude?:  string;
      longitude?: string;
      userId?:    string;
      type:       string;
      reportId:   string;
    }
  ): Promise<void> {
    try {
      const [locationRisk, repetitionScore, userTrustScore] = await Promise.all([
        this.computeLocationRisk(input.latitude, input.longitude),
        this.computeRepetitionScore(input.type, input.latitude, input.longitude),
        this.computeUserTrustScore(input.userId),
      ]);

      const w = adaptiveWeights.isReady() ? adaptiveWeights.getWeights() : null;
      const modelVersion = w ? w.version : "v0-static";

      const fusedScore = w
        ? w.aiScore * aiScore + w.locationRisk * locationRisk + w.repetitionScore * repetitionScore + w.userTrust * userTrustScore
        : this.STATIC_WEIGHTS.aiUrgency * aiScore + this.STATIC_WEIGHTS.locationRisk * locationRisk + this.STATIC_WEIGHTS.repetitionScore * repetitionScore + this.STATIC_WEIGHTS.userTrustScore * userTrustScore;

      await featureStore.save(
        input.reportId,
        { aiScore, locationRisk, repetitionScore, userTrust: userTrustScore, weatherScore: 0, socialScore: 0 },
        Math.min(1, Math.max(0, fusedScore)),
        modelVersion,
      );
    } catch (err) {
      logger.warn("[SignalFusion] computeFeatureVector failed", { reportId: input.reportId });
    }
  }

  private async computeUserTrustScore(userId?: string): Promise<number> {
    if (!userId) return 0.5;

    try {
      const rep = await db.select().from(userReputation).where(eq(userReputation.userId, userId));
      if (!rep[0]) return 0.5;

      const trustScore = rep[0].trustScore;
      const falseRate = rep[0].totalReports > 0
        ? rep[0].falseReports / rep[0].totalReports
        : 0;

      const baseScore = trustScore / 100;
      const penalized = baseScore * (1 - Math.min(0.5, falseRate));
      return Math.min(1, Math.max(0.1, penalized));
    } catch (error) {
      logger.error("User trust score computation error", error as Error);
      return 0.5;
    }
  }
}

export const signalFusionService = new SignalFusionService();
