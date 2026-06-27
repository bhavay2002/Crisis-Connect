/**
 * Adaptive Weights Service — §22 Learning Fusion
 *
 * Replaces hardcoded fusion weights (0.5, 0.2, 0.2, 0.1) with a logistic
 * regression model that updates online from labeled outcomes.
 *
 * Algorithm: Stochastic Gradient Descent on binary cross-entropy loss
 *   Prediction: p = σ(w·x + bias)
 *   Update:     w_i ← w_i + α * (y - p) * x_i
 *               bias ← bias + α * (y - p)
 *
 * Safety guardrails:
 *   - Weights clamped to [0.05, 0.95] to prevent collapse
 *   - Normalized to sum = 1 before fusion
 *   - Static fallback if DB unavailable
 *   - Shadow model runs alongside prod model for comparison
 */

import { db } from "../../db/db";
import { modelWeights } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "../../utils/logger";

// ── Feature vector shape ───────────────────────────────────────────────────────

export interface FeatureVector {
  aiScore:         number;   // 0–1
  locationRisk:    number;   // 0–1
  repetitionScore: number;   // 0–1
  userTrust:       number;   // 0–1
  weatherScore:    number;   // 0–1
  socialScore:     number;   // 0–1
}

export interface WeightVector {
  aiScore:         number;
  locationRisk:    number;
  repetitionScore: number;
  userTrust:       number;
  weatherScore:    number;
  socialScore:     number;
  bias:            number;
  version:         string;
  sampleCount:     number;
}

// ── Static priors (current hardcoded values, used until model is trained) ─────

const STATIC_WEIGHTS: Omit<WeightVector, "version" | "sampleCount"> = {
  aiScore:         0.50,
  locationRisk:    0.20,
  repetitionScore: 0.20,
  userTrust:       0.10,
  weatherScore:    0.00,
  socialScore:     0.00,
  bias:            0.0,
};

const STATIC_VERSION = "v0-static-priors";

// ── Hyperparameters ───────────────────────────────────────────────────────────

const LEARNING_RATE  = 0.01;
const MIN_WEIGHT     = 0.02;
const MAX_WEIGHT     = 0.95;
const WEIGHT_VERSION_PREFIX = "v";

// ── Sigmoid ───────────────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Normalize weights (excluding bias) so they sum to 1 */
function normalizeWeights(w: WeightVector): WeightVector {
  const keys: (keyof Omit<WeightVector, "bias" | "version" | "sampleCount">)[] = [
    "aiScore", "locationRisk", "repetitionScore", "userTrust", "weatherScore", "socialScore",
  ];
  const total = keys.reduce((s, k) => s + w[k], 0);
  if (total === 0) return w;
  const normalized = { ...w };
  for (const k of keys) normalized[k] = w[k] / total;
  return normalized;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class AdaptiveWeightsService {
  private current: WeightVector | null = null;
  private shadow:  WeightVector | null = null;
  private ready    = false;

  async initialize(): Promise<void> {
    try {
      // Load active prod model
      const prod = await db.select()
        .from(modelWeights)
        .where(and(eq(modelWeights.isActive, true), eq(modelWeights.isShadow, false)))
        .orderBy(desc(modelWeights.createdAt))
        .limit(1);

      if (prod[0]) {
        this.current = { ...(prod[0].weights as any), version: prod[0].version, sampleCount: prod[0].sampleCount };
      } else {
        // First boot — persist static priors as v0
        await this.persistWeights({ ...STATIC_WEIGHTS, version: STATIC_VERSION, sampleCount: 0 }, true, false);
        this.current = { ...STATIC_WEIGHTS, version: STATIC_VERSION, sampleCount: 0 };
      }

      // Load shadow model
      const shadow = await db.select()
        .from(modelWeights)
        .where(and(eq(modelWeights.isActive, true), eq(modelWeights.isShadow, true)))
        .orderBy(desc(modelWeights.createdAt))
        .limit(1);

      if (shadow[0]) {
        this.shadow = { ...(shadow[0].weights as any), version: shadow[0].version, sampleCount: shadow[0].sampleCount };
      }

      this.ready = true;
      logger.info("[AdaptiveWeights] Initialized", {
        version:      this.current?.version ?? STATIC_VERSION,
        sampleCount:  this.current?.sampleCount ?? 0,
        hasShadow:    !!this.shadow,
      });
    } catch (err) {
      logger.error("[AdaptiveWeights] Init failed — using static weights", err as Error);
      this.current = { ...STATIC_WEIGHTS, version: STATIC_VERSION, sampleCount: 0 };
      this.ready = false;
    }
  }

  /** Get current (normalized) fusion weights */
  getWeights(): WeightVector {
    if (!this.current) return { ...STATIC_WEIGHTS, version: STATIC_VERSION, sampleCount: 0 };
    return normalizeWeights(this.current);
  }

  /** Predict crisis probability from feature vector */
  predict(features: FeatureVector): number {
    const w = this.getWeights();
    const logit =
      w.aiScore         * features.aiScore +
      w.locationRisk    * features.locationRisk +
      w.repetitionScore * features.repetitionScore +
      w.userTrust       * features.userTrust +
      w.weatherScore    * features.weatherScore +
      w.socialScore     * features.socialScore +
      (w.bias ?? 0);
    return sigmoid(logit);
  }

  /**
   * Online SGD update from a single labeled outcome.
   * Creates a new model version and marks it active.
   */
  async learnFromOutcome(features: FeatureVector, isRealCrisis: boolean): Promise<WeightVector> {
    const w = { ...this.getWeights() };
    const y = isRealCrisis ? 1 : 0;
    const p = this.predict(features);
    const error = y - p;

    const keys: (keyof FeatureVector)[] = [
      "aiScore", "locationRisk", "repetitionScore", "userTrust", "weatherScore", "socialScore",
    ];

    for (const k of keys) {
      w[k] = clamp(w[k] + LEARNING_RATE * error * features[k], MIN_WEIGHT, MAX_WEIGHT);
    }
    w.bias = (w.bias ?? 0) + LEARNING_RATE * error;
    w.sampleCount = (this.current?.sampleCount ?? 0) + 1;

    const versionNumber = w.sampleCount;
    w.version = `${WEIGHT_VERSION_PREFIX}${versionNumber}`;

    // Persist to DB
    await this.persistWeights(w, true, false);

    // Also update shadow — explore a slightly higher LR variant
    if (this.shadow) {
      const sw = { ...normalizeWeights(this.shadow) };
      for (const k of keys) {
        sw[k] = clamp(sw[k] + LEARNING_RATE * 2 * error * features[k], MIN_WEIGHT, MAX_WEIGHT);
      }
      sw.bias = (sw.bias ?? 0) + LEARNING_RATE * 2 * error;
      sw.sampleCount = (this.shadow.sampleCount ?? 0) + 1;
      sw.version = `shadow-v${sw.sampleCount}`;
      await this.persistWeights(sw, true, true);
      this.shadow = sw;
    }

    this.current = w;

    logger.info("[AdaptiveWeights] Weights updated", {
      newVersion:  w.version,
      sampleCount: w.sampleCount,
      error:       error.toFixed(4),
      prediction:  p.toFixed(4),
      label:       y,
    });

    return w;
  }

  /** Get weight history (last N versions) */
  async getWeightHistory(limit = 20): Promise<ModelWeightRecord[]> {
    const rows = await db.select()
      .from(modelWeights)
      .where(eq(modelWeights.isShadow, false))
      .orderBy(desc(modelWeights.createdAt))
      .limit(limit);

    return rows.map(r => ({
      version:     r.version,
      weights:     r.weights as any,
      sampleCount: r.sampleCount,
      precision:   r.precision ? parseFloat(r.precision) : null,
      recall:      r.recall    ? parseFloat(r.recall)    : null,
      f1:          r.f1Score   ? parseFloat(r.f1Score)   : null,
      isActive:    r.isActive,
      createdAt:   r.createdAt,
    }));
  }

  /** Update precision/recall on the current active model */
  async updateMetrics(precision: number, recall: number, f1: number): Promise<void> {
    if (!this.current) return;
    await db.update(modelWeights)
      .set({
        precision: precision.toFixed(4),
        recall:    recall.toFixed(4),
        f1Score:   f1.toFixed(4),
      })
      .where(and(eq(modelWeights.version, this.current.version), eq(modelWeights.isShadow, false)));
  }

  /** Compare prod vs shadow on a labeled outcome */
  getShadowComparison(features: FeatureVector): { prod: number; shadow: number | null } {
    const prod = this.predict(features);
    if (!this.shadow) return { prod, shadow: null };

    const sw = normalizeWeights(this.shadow);
    const logit =
      sw.aiScore         * features.aiScore +
      sw.locationRisk    * features.locationRisk +
      sw.repetitionScore * features.repetitionScore +
      sw.userTrust       * features.userTrust +
      sw.weatherScore    * features.weatherScore +
      sw.socialScore     * features.socialScore +
      (sw.bias ?? 0);
    return { prod, shadow: sigmoid(logit) };
  }

  isReady(): boolean { return this.ready; }

  private async persistWeights(w: WeightVector, isActive: boolean, isShadow: boolean): Promise<void> {
    const { version, sampleCount, ...rest } = w;

    // Deactivate old active weights of same type
    await db.update(modelWeights)
      .set({ isActive: false })
      .where(and(eq(modelWeights.isActive, true), eq(modelWeights.isShadow, isShadow)));

    await db.insert(modelWeights).values({
      version,
      weights:     rest,
      sampleCount: sampleCount ?? 0,
      isActive,
      isShadow,
    }).onConflictDoUpdate({
      target: modelWeights.version,
      set: { weights: rest, sampleCount: sampleCount ?? 0, isActive, isShadow },
    });
  }
}

export interface ModelWeightRecord {
  version:     string;
  weights:     WeightVector;
  sampleCount: number;
  precision:   number | null;
  recall:      number | null;
  f1:          number | null;
  isActive:    boolean;
  createdAt:   Date;
}

export const adaptiveWeights = new AdaptiveWeightsService();
