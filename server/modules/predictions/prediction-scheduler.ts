/**
 * §28 — Prediction Scheduler + Signal Spike Detector
 *
 * Two triggers for prediction runs:
 *   1. Scheduled: every 10 minutes via cron
 *   2. Spike-triggered: when ≥ 3 reports arrive in the same zone within 15 minutes
 *
 * Also upgrades VERY_HIGH risk prediction-triggered PREDEPLOY decisions to
 * autoExecutable: true — so they execute without waiting for operator approval.
 */

import schedule from "node-cron";
import { generateAllPredictions } from "./predictive-response.service";
import { eventStore, EVENT_TYPES } from "../events/event-store.service";
import { pubSub, CHANNELS } from "../../utils/pubsub";
import { logger } from "../../utils/logger";

// ── Scheduler state ───────────────────────────────────────────────────────────

interface SchedulerStatus {
  isRunning:       boolean;
  lastRunAt:       string | null;
  lastRunDuration: number | null;   // ms
  lastPredictionCount: number;
  totalRuns:       number;
  spikeTriggeredRuns: number;
  nextRunAt:       string | null;
  errors:          number;
}

const state: SchedulerStatus = {
  isRunning:           false,
  lastRunAt:           null,
  lastRunDuration:     null,
  lastPredictionCount: 0,
  totalRuns:           0,
  spikeTriggeredRuns:  0,
  nextRunAt:           null,
  errors:              0,
};

// ── Signal spike tracker ──────────────────────────────────────────────────────
// Tracks recent report creation events per zone for spike detection

const zoneReportTimestamps = new Map<string, number[]>(); // zone → [timestamp ms]
const SPIKE_WINDOW_MS  = 15 * 60 * 1000; // 15 minutes
const SPIKE_THRESHOLD  = 3;              // 3+ reports in window = spike
const SPIKE_COOLDOWN_MS = 5 * 60 * 1000; // don't re-trigger same zone within 5 min
const lastSpikeTrigger = new Map<string, number>();       // zone → last trigger timestamp

// ── Core run logic ────────────────────────────────────────────────────────────

async function runPredictions(trigger: "scheduled" | "spike", zone?: string): Promise<void> {
  if (state.isRunning) {
    logger.debug("[PredictionScheduler] Run skipped — previous run still active");
    return;
  }

  state.isRunning = true;
  const start = Date.now();

  try {
    logger.info("[PredictionScheduler] Starting prediction run", { trigger, zone });

    const predictions = await generateAllPredictions();

    const duration = Date.now() - start;
    state.lastRunAt      = new Date().toISOString();
    state.lastRunDuration = duration;
    state.lastPredictionCount = predictions.length;
    state.totalRuns++;
    if (trigger === "spike") state.spikeTriggeredRuns++;

    // Persist to durable event store
    await eventStore.append({
      eventType:  EVENT_TYPES.PREDICTION_GENERATED,
      entityType: "prediction_batch",
      payload: {
        trigger,
        zone: zone ?? "all",
        predictionCount: predictions.length,
        highRisk: predictions.filter(p => p.riskLevel === "HIGH" || p.riskLevel === "VERY_HIGH").length,
        durationMs: duration,
      },
    });

    // Real-time broadcast for live dashboard
    pubSub.publish("prediction:batch_complete", {
      trigger,
      predictionCount: predictions.length,
      timestamp: state.lastRunAt,
    }).catch(() => {});

    logger.info("[PredictionScheduler] Run complete", {
      trigger,
      predictions: predictions.length,
      durationMs: duration,
    });
  } catch (err) {
    state.errors++;
    logger.error("[PredictionScheduler] Run failed", err as Error, { trigger, zone });
  } finally {
    state.isRunning = false;
  }
}

// ── Spike detector ────────────────────────────────────────────────────────────

export function recordReportForSpikeDetection(zone: string, timestamp: number = Date.now()): void {
  const now = Date.now();
  const cutoff = now - SPIKE_WINDOW_MS;

  // Get or initialize the zone's timestamp list
  let timestamps = zoneReportTimestamps.get(zone) ?? [];

  // Prune old timestamps outside the window
  timestamps = timestamps.filter(t => t > cutoff);
  timestamps.push(timestamp);
  zoneReportTimestamps.set(zone, timestamps);

  logger.debug("[PredictionScheduler] Spike tracker updated", {
    zone,
    reportsInWindow: timestamps.length,
    threshold: SPIKE_THRESHOLD,
  });

  // Check if spike threshold is met
  if (timestamps.length >= SPIKE_THRESHOLD) {
    const lastTrigger = lastSpikeTrigger.get(zone) ?? 0;
    if (now - lastTrigger > SPIKE_COOLDOWN_MS) {
      lastSpikeTrigger.set(zone, now);

      logger.warn("[PredictionScheduler] Signal spike detected — triggering prediction run", {
        zone,
        reportsInWindow: timestamps.length,
      });

      // Emit spike event to durable store
      eventStore.append({
        eventType:  EVENT_TYPES.SPIKE_DETECTED,
        entityType: "zone",
        entityId:   zone,
        payload: {
          zone,
          reportsInWindow: timestamps.length,
          windowMinutes: SPIKE_WINDOW_MS / 60000,
          triggeredAt: new Date().toISOString(),
        },
      }).catch(() => {});

      // Broadcast to real-time subscribers
      pubSub.publish("prediction:spike_detected", { zone, reportsInWindow: timestamps.length }).catch(() => {});

      // Trigger prediction run (async, non-blocking)
      runPredictions("spike", zone).catch(() => {});
    } else {
      logger.debug("[PredictionScheduler] Spike cooldown active — skipping trigger", { zone });
    }
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

let cronJob: ReturnType<typeof schedule.schedule> | null = null;

export function startPredictionScheduler(): void {
  if (cronJob) {
    logger.warn("[PredictionScheduler] Scheduler already running");
    return;
  }

  // Run every 10 minutes
  cronJob = schedule.schedule("*/10 * * * *", async () => {
    await runPredictions("scheduled");
    // Update next run time
    state.nextRunAt = getNextRunAt();
  });

  state.nextRunAt = getNextRunAt();

  logger.info("[PredictionScheduler] Started — running every 10 minutes");
}

export function stopPredictionScheduler(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    logger.info("[PredictionScheduler] Stopped");
  }
}

export function getSchedulerStatus(): SchedulerStatus & {
  spikeTrackerZones: number;
  cronExpression: string;
} {
  return {
    ...state,
    spikeTrackerZones: zoneReportTimestamps.size,
    cronExpression:    "*/10 * * * *",
  };
}

export function triggerManualRun(): Promise<void> {
  return runPredictions("scheduled");
}

// ── Helper ────────────────────────────────────────────────────────────────────

function getNextRunAt(): string {
  // Next multiple of 10 minutes
  const now = new Date();
  const minutes = now.getMinutes();
  const nextMinutes = (Math.floor(minutes / 10) + 1) * 10;
  const next = new Date(now);
  next.setMinutes(nextMinutes, 0, 0);
  if (next <= now) next.setMinutes(next.getMinutes() + 10);
  return next.toISOString();
}
