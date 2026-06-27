/**
 * Feature Store — §22 Learning Fusion
 *
 * Persists the signal feature vector for every report at fusion time.
 * This is the training data source for the adaptive weights model.
 *
 * Schema: signal_features (reportId, ai, location, repetition, trust, weather, social, fused, modelVersion)
 */

import { db } from "../../db/db";
import { signalFeatures } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "../../utils/logger";
import type { FeatureVector } from "./adaptive-weights.service";

export interface StoredFeatures extends FeatureVector {
  reportId:     string;
  fusedScore:   number;
  modelVersion: string;
  createdAt:    Date;
}

export class FeatureStoreService {
  /** Persist feature vector immediately after fusion */
  async save(
    reportId:     string,
    features:     FeatureVector,
    fusedScore:   number,
    modelVersion: string,
  ): Promise<void> {
    try {
      await db.insert(signalFeatures).values({
        reportId,
        aiScore:         String(features.aiScore),
        locationRisk:    String(features.locationRisk),
        repetitionScore: String(features.repetitionScore),
        userTrust:       String(features.userTrust),
        weatherScore:    String(features.weatherScore),
        socialScore:     String(features.socialScore),
        fusedScore:      String(fusedScore),
        modelVersion,
      }).onConflictDoNothing();

      logger.debug("[FeatureStore] Saved features", { reportId, modelVersion });
    } catch (err) {
      logger.error("[FeatureStore] Save failed", err as Error, { reportId });
    }
  }

  /** Retrieve stored features for a specific report */
  async get(reportId: string): Promise<StoredFeatures | null> {
    try {
      const rows = await db.select()
        .from(signalFeatures)
        .where(eq(signalFeatures.reportId, reportId))
        .limit(1);

      if (!rows[0]) return null;
      return this.toStoredFeatures(rows[0]);
    } catch (err) {
      logger.error("[FeatureStore] Get failed", err as Error, { reportId });
      return null;
    }
  }

  /** Retrieve the N most recent feature vectors (for batch metrics) */
  async getRecent(n = 100): Promise<StoredFeatures[]> {
    try {
      const rows = await db.select()
        .from(signalFeatures)
        .orderBy(desc(signalFeatures.createdAt))
        .limit(n);

      return rows.map(r => this.toStoredFeatures(r));
    } catch (err) {
      logger.error("[FeatureStore] GetRecent failed", err as Error);
      return [];
    }
  }

  private toStoredFeatures(row: any): StoredFeatures {
    return {
      reportId:        row.reportId,
      aiScore:         parseFloat(row.aiScore ?? "0"),
      locationRisk:    parseFloat(row.locationRisk ?? "0"),
      repetitionScore: parseFloat(row.repetitionScore ?? "0"),
      userTrust:       parseFloat(row.userTrust ?? "0"),
      weatherScore:    parseFloat(row.weatherScore ?? "0"),
      socialScore:     parseFloat(row.socialScore ?? "0"),
      fusedScore:      parseFloat(row.fusedScore ?? "0"),
      modelVersion:    row.modelVersion ?? "unknown",
      createdAt:       row.createdAt,
    };
  }
}

export const featureStore = new FeatureStoreService();
