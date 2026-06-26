/**
 * Adaptive Fusion API — §22 Learning System
 *
 * GET  /api/fusion/model            — current weights, version, metrics
 * GET  /api/fusion/performance      — precision/recall trend, weight history
 * POST /api/fusion/outcomes/:id     — label a report outcome (triggers weight update)
 * GET  /api/fusion/features/:id     — stored feature vector for a report
 * GET  /api/fusion/outcomes         — recent labeled outcomes
 * POST /api/fusion/simulate         — run a prediction against current model
 */

import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { adaptiveWeights } from "../modules/fusion/adaptive-weights.service";
import { featureStore } from "../modules/fusion/feature-store.service";
import { outcomeCollector } from "../modules/fusion/outcome-collector.service";
import { logger } from "../utils/logger";

export function registerAdaptiveFusionRoutes(app: Express) {

  // ── Current model state ───────────────────────────────────────────────────
  app.get("/api/fusion/model", isAuthenticated, async (_req, res) => {
    try {
      const w = adaptiveWeights.getWeights();
      const history = await adaptiveWeights.getWeightHistory(5);
      const metrics = await outcomeCollector.computeMetrics();

      // Update stored precision/recall
      if (metrics.n > 0) {
        await adaptiveWeights.updateMetrics(metrics.precision, metrics.recall, metrics.f1);
      }

      const keys = ["aiScore", "locationRisk", "repetitionScore", "userTrust", "weatherScore", "socialScore"] as const;
      const contributions = keys.map(k => ({
        feature:      k,
        weight:       parseFloat(w[k].toFixed(4)),
        label:        featureLabel(k),
        description:  featureDescription(k),
      })).sort((a, b) => b.weight - a.weight);

      res.json({
        model: {
          version:     w.version,
          sampleCount: w.sampleCount,
          isAdaptive:  adaptiveWeights.isReady() && w.sampleCount > 0,
          mode:        w.sampleCount === 0 ? "static-priors" : "adaptive-sgd",
          algorithm:   "logistic-regression-sgd",
          learningRate: 0.01,
          bias:         parseFloat((w.bias ?? 0).toFixed(4)),
        },
        weights:      contributions,
        metrics: {
          precision:   metrics.n > 0 ? parseFloat(metrics.precision.toFixed(4)) : null,
          recall:      metrics.n > 0 ? parseFloat(metrics.recall.toFixed(4))    : null,
          f1:          metrics.n > 0 ? parseFloat(metrics.f1.toFixed(4))        : null,
          sampleCount: metrics.n,
        },
        recentVersions: history.slice(0, 3).map(h => ({
          version:     h.version,
          sampleCount: h.sampleCount,
          isActive:    h.isActive,
          createdAt:   h.createdAt,
        })),
        guardrails: {
          minWeight: 0.02,
          maxWeight: 0.95,
          normalization: "sum-to-1",
          fallback: "static-priors-on-error",
        },
      });
    } catch (err) {
      logger.error("GET /api/fusion/model failed", err as Error);
      res.status(500).json({ message: "Failed to load model state" });
    }
  });

  // ── Weight history + performance trend ────────────────────────────────────
  app.get("/api/fusion/performance", isAuthenticated, async (_req, res) => {
    try {
      const history = await adaptiveWeights.getWeightHistory(30);
      const recent  = await outcomeCollector.getRecent(20);
      const metrics = await outcomeCollector.computeMetrics();

      res.json({
        currentMetrics: {
          precision:   metrics.n > 0 ? parseFloat(metrics.precision.toFixed(4)) : null,
          recall:      metrics.n > 0 ? parseFloat(metrics.recall.toFixed(4))    : null,
          f1:          metrics.n > 0 ? parseFloat(metrics.f1.toFixed(4))        : null,
          totalLabeled: metrics.n,
        },
        weightHistory: history.map(h => ({
          version:     h.version,
          sampleCount: h.sampleCount,
          weights: {
            aiScore:         parseFloat((h.weights.aiScore ?? 0).toFixed(4)),
            locationRisk:    parseFloat((h.weights.locationRisk ?? 0).toFixed(4)),
            repetitionScore: parseFloat((h.weights.repetitionScore ?? 0).toFixed(4)),
            userTrust:       parseFloat((h.weights.userTrust ?? 0).toFixed(4)),
            weatherScore:    parseFloat((h.weights.weatherScore ?? 0).toFixed(4)),
            socialScore:     parseFloat((h.weights.socialScore ?? 0).toFixed(4)),
          },
          precision:   h.precision,
          recall:      h.recall,
          f1:          h.f1,
          isActive:    h.isActive,
          createdAt:   h.createdAt,
        })),
        recentOutcomes: recent.map(o => ({
          reportId:     o.reportId,
          isRealCrisis: o.isRealCrisis,
          falsePositive:o.falsePositive,
          labelSource:  o.labelSource,
          createdAt:    o.createdAt,
        })),
      });
    } catch (err) {
      logger.error("GET /api/fusion/performance failed", err as Error);
      res.status(500).json({ message: "Failed to load performance data" });
    }
  });

  // ── Record outcome + trigger weight update ────────────────────────────────
  app.post("/api/fusion/outcomes/:reportId", isAuthenticated, requireRole("admin", "super_admin", "authority", "government"), async (req: any, res) => {
    try {
      const { reportId } = req.params;
      const { isRealCrisis, falsePositive, responseTimeSec } = req.body;

      if (typeof isRealCrisis !== "boolean") {
        return res.status(400).json({ message: "isRealCrisis (boolean) is required" });
      }

      const outcome = await outcomeCollector.record(reportId, isRealCrisis, {
        falsePositive:   falsePositive ?? !isRealCrisis,
        responseTimeSec: responseTimeSec ?? null,
        labelSource:     "manual",
        labeledBy:       req.user?.userId,
      });

      if (!outcome) {
        return res.status(409).json({ message: "Outcome already recorded for this report" });
      }

      const updatedWeights = adaptiveWeights.getWeights();
      res.json({
        outcome,
        updatedModel: {
          version:     updatedWeights.version,
          sampleCount: updatedWeights.sampleCount,
          weights: {
            aiScore:         parseFloat(updatedWeights.aiScore.toFixed(4)),
            locationRisk:    parseFloat(updatedWeights.locationRisk.toFixed(4)),
            repetitionScore: parseFloat(updatedWeights.repetitionScore.toFixed(4)),
            userTrust:       parseFloat(updatedWeights.userTrust.toFixed(4)),
          },
        },
      });
    } catch (err) {
      logger.error("POST /api/fusion/outcomes failed", err as Error);
      res.status(500).json({ message: "Failed to record outcome" });
    }
  });

  // ── Get stored features for a report ────────────────────────────────────
  app.get("/api/fusion/features/:reportId", isAuthenticated, async (req, res) => {
    try {
      const features = await featureStore.get(req.params.reportId);
      if (!features) {
        return res.status(404).json({ message: "No features stored for this report" });
      }

      const w = adaptiveWeights.getWeights();
      const prediction = adaptiveWeights.predict({
        aiScore:         features.aiScore,
        locationRisk:    features.locationRisk,
        repetitionScore: features.repetitionScore,
        userTrust:       features.userTrust,
        weatherScore:    features.weatherScore,
        socialScore:     features.socialScore,
      });

      const shadow = adaptiveWeights.getShadowComparison({
        aiScore:         features.aiScore,
        locationRisk:    features.locationRisk,
        repetitionScore: features.repetitionScore,
        userTrust:       features.userTrust,
        weatherScore:    features.weatherScore,
        socialScore:     features.socialScore,
      });

      res.json({
        features,
        prediction: {
          crisisProbability: parseFloat(prediction.toFixed(4)),
          label:             prediction >= 0.5 ? "real-crisis" : "non-crisis",
          modelVersion:      w.version,
        },
        shadowComparison: shadow.shadow !== null ? {
          prodPrediction:   parseFloat(shadow.prod.toFixed(4)),
          shadowPrediction: parseFloat(shadow.shadow.toFixed(4)),
          delta:            parseFloat(Math.abs(shadow.prod - shadow.shadow).toFixed(4)),
        } : null,
        contributions: [
          { feature: "AI Score",          value: features.aiScore,         weight: parseFloat(w.aiScore.toFixed(4)),         contribution: parseFloat((w.aiScore * features.aiScore).toFixed(4)) },
          { feature: "Location Risk",     value: features.locationRisk,    weight: parseFloat(w.locationRisk.toFixed(4)),    contribution: parseFloat((w.locationRisk * features.locationRisk).toFixed(4)) },
          { feature: "Repetition Score",  value: features.repetitionScore, weight: parseFloat(w.repetitionScore.toFixed(4)), contribution: parseFloat((w.repetitionScore * features.repetitionScore).toFixed(4)) },
          { feature: "User Trust",        value: features.userTrust,       weight: parseFloat(w.userTrust.toFixed(4)),       contribution: parseFloat((w.userTrust * features.userTrust).toFixed(4)) },
          { feature: "Weather Risk",      value: features.weatherScore,    weight: parseFloat(w.weatherScore.toFixed(4)),    contribution: parseFloat((w.weatherScore * features.weatherScore).toFixed(4)) },
          { feature: "Social Signal",     value: features.socialScore,     weight: parseFloat(w.socialScore.toFixed(4)),     contribution: parseFloat((w.socialScore * features.socialScore).toFixed(4)) },
        ].sort((a, b) => b.contribution - a.contribution),
      });
    } catch (err) {
      logger.error("GET /api/fusion/features failed", err as Error);
      res.status(500).json({ message: "Failed to load features" });
    }
  });

  // ── Recent outcomes list ──────────────────────────────────────────────────
  app.get("/api/fusion/outcomes", isAuthenticated, requireRole("admin", "super_admin", "authority", "government"), async (_req, res) => {
    try {
      const outcomes = await outcomeCollector.getRecent(50);
      res.json({ outcomes });
    } catch (err) {
      res.status(500).json({ message: "Failed to load outcomes" });
    }
  });

  // ── Simulate prediction against current model ─────────────────────────────
  app.post("/api/fusion/simulate", isAuthenticated, async (req, res) => {
    try {
      const { aiScore = 0.5, locationRisk = 0.3, repetitionScore = 0.1, userTrust = 0.7, weatherScore = 0, socialScore = 0 } = req.body;
      const features = { aiScore, locationRisk, repetitionScore, userTrust, weatherScore, socialScore };

      const w = adaptiveWeights.getWeights();
      const prob = adaptiveWeights.predict(features);
      const shadow = adaptiveWeights.getShadowComparison(features);

      res.json({
        features,
        prediction: {
          crisisProbability: parseFloat(prob.toFixed(4)),
          label:             prob >= 0.5 ? "real-crisis" : "non-crisis",
          confidence:        parseFloat(Math.abs(prob - 0.5).toFixed(4)),
          modelVersion:      w.version,
        },
        shadow: shadow.shadow !== null ? {
          prodPrediction:   parseFloat(shadow.prod.toFixed(4)),
          shadowPrediction: parseFloat(shadow.shadow.toFixed(4)),
        } : null,
        weights: {
          aiScore:         parseFloat(w.aiScore.toFixed(4)),
          locationRisk:    parseFloat(w.locationRisk.toFixed(4)),
          repetitionScore: parseFloat(w.repetitionScore.toFixed(4)),
          userTrust:       parseFloat(w.userTrust.toFixed(4)),
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Simulation failed" });
    }
  });
}

function featureLabel(key: string): string {
  const map: Record<string, string> = {
    aiScore:         "AI Score",
    locationRisk:    "Location Risk",
    repetitionScore: "Repetition Score",
    userTrust:       "User Trust",
    weatherScore:    "Weather Risk",
    socialScore:     "Social Signal",
  };
  return map[key] ?? key;
}

function featureDescription(key: string): string {
  const map: Record<string, string> = {
    aiScore:         "GPT-4o urgency analysis (0–10 normalized)",
    locationRisk:    "Haversine-weighted risk from nearby recent reports",
    repetitionScore: "Same-type report density within 500m/1h",
    userTrust:       "Reporter's trust score minus false report penalty",
    weatherScore:    "External weather alert severity",
    socialScore:     "Social media spike intensity",
  };
  return map[key] ?? "";
}
