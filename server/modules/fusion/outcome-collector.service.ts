/**
 * Outcome Collector — §22 Learning Fusion
 *
 * Records outcome labels for reports, then triggers an adaptive weights update.
 * Labels can come from:
 *   1. Manual admin review      → POST /api/fusion/outcomes/:id
 *   2. Auto: verified count ≥ 3 → isRealCrisis = true
 *   3. Auto: flagged as spam    → isRealCrisis = false (falsePositive = true)
 *   4. Auto: status = resolved  → isRealCrisis = true (soft label)
 *
 * Each new outcome triggers one SGD step in AdaptiveWeightsService.
 */

import { db } from "../../db/db";
import { signalOutcomes } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "../../utils/logger";
import { adaptiveWeights } from "./adaptive-weights.service";
import { featureStore } from "./feature-store.service";

export type LabelSource = "manual" | "auto_verified" | "auto_flagged" | "auto_resolved";

export interface OutcomeRecord {
  reportId:        string;
  isRealCrisis:    boolean;
  falsePositive:   boolean;
  responseTimeSec: number | null;
  labelSource:     LabelSource;
  labeledBy?:      string;
  createdAt:       Date;
}

export class OutcomeCollectorService {
  /**
   * Record an outcome and trigger one adaptive weight update.
   * Returns null if features for the report aren't in the store.
   */
  async record(
    reportId:        string,
    isRealCrisis:    boolean,
    opts: {
      falsePositive?:   boolean;
      responseTimeSec?: number;
      labelSource?:     LabelSource;
      labeledBy?:       string;
    } = {}
  ): Promise<OutcomeRecord | null> {
    try {
      // Idempotency guard
      const existing = await db.select()
        .from(signalOutcomes)
        .where(eq(signalOutcomes.reportId, reportId))
        .limit(1);

      if (existing[0]) {
        logger.debug("[OutcomeCollector] Outcome already recorded", { reportId });
        return null;
      }

      const labelSource = opts.labelSource ?? "manual";

      await db.insert(signalOutcomes).values({
        reportId,
        isRealCrisis,
        falsePositive:   opts.falsePositive ?? !isRealCrisis,
        responseTimeSec: opts.responseTimeSec ?? null,
        labelSource,
        labeledBy:       opts.labeledBy ?? null,
      });

      logger.info("[OutcomeCollector] Outcome recorded", { reportId, isRealCrisis, labelSource });

      // Fetch stored features → trigger weight update
      const features = await featureStore.get(reportId);
      if (features) {
        await adaptiveWeights.learnFromOutcome(
          {
            aiScore:         features.aiScore,
            locationRisk:    features.locationRisk,
            repetitionScore: features.repetitionScore,
            userTrust:       features.userTrust,
            weatherScore:    features.weatherScore,
            socialScore:     features.socialScore,
          },
          isRealCrisis
        );
      } else {
        logger.warn("[OutcomeCollector] No features found for report — weight update skipped", { reportId });
      }

      return {
        reportId,
        isRealCrisis,
        falsePositive:   opts.falsePositive ?? !isRealCrisis,
        responseTimeSec: opts.responseTimeSec ?? null,
        labelSource,
        labeledBy:       opts.labeledBy,
        createdAt:       new Date(),
      };
    } catch (err) {
      logger.error("[OutcomeCollector] Record failed", err as Error, { reportId });
      return null;
    }
  }

  /** Auto-label from report verification (called when verificationCount crosses threshold) */
  async autoLabelVerified(reportId: string): Promise<void> {
    await this.record(reportId, true, { labelSource: "auto_verified" });
  }

  /** Auto-label from flag (called when admin flags as false_report) */
  async autoLabelFlagged(reportId: string): Promise<void> {
    await this.record(reportId, false, { falsePositive: true, labelSource: "auto_flagged" });
  }

  /** Auto-label from resolution */
  async autoLabelResolved(reportId: string, responseTimeSec?: number): Promise<void> {
    await this.record(reportId, true, { responseTimeSec, labelSource: "auto_resolved" });
  }

  /** Get recent outcomes (for metrics) */
  async getRecent(n = 50): Promise<OutcomeRecord[]> {
    const rows = await db.select()
      .from(signalOutcomes)
      .orderBy(desc(signalOutcomes.createdAt))
      .limit(n);

    return rows.map(r => ({
      reportId:        r.reportId,
      isRealCrisis:    r.isRealCrisis,
      falsePositive:   r.falsePositive,
      responseTimeSec: r.responseTimeSec,
      labelSource:     r.labelSource as LabelSource,
      labeledBy:       r.labeledBy ?? undefined,
      createdAt:       r.createdAt,
    }));
  }

  /** Compute precision / recall from recent labeled outcomes vs model predictions */
  async computeMetrics(): Promise<{ precision: number; recall: number; f1: number; n: number }> {
    const outcomes = await this.getRecent(200);
    if (outcomes.length === 0) return { precision: 0, recall: 0, f1: 0, n: 0 };

    let tp = 0, fp = 0, fn = 0;

    for (const o of outcomes) {
      const features = await featureStore.get(o.reportId);
      if (!features) continue;

      const predicted = adaptiveWeights.predict({
        aiScore:         features.aiScore,
        locationRisk:    features.locationRisk,
        repetitionScore: features.repetitionScore,
        userTrust:       features.userTrust,
        weatherScore:    features.weatherScore,
        socialScore:     features.socialScore,
      }) >= 0.5;

      if (predicted && o.isRealCrisis)   tp++;
      if (predicted && !o.isRealCrisis)  fp++;
      if (!predicted && o.isRealCrisis)  fn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
    const recall    = tp + fn > 0 ? tp / (tp + fn) : 1;
    const f1        = precision + recall > 0
      ? 2 * (precision * recall) / (precision + recall)
      : 0;

    return { precision, recall, f1, n: outcomes.length };
  }
}

export const outcomeCollector = new OutcomeCollectorService();
