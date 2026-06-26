/**
 * AI Analysis Worker — §21 Async Pipeline
 *
 * Registered on the shared `jobQueue` singleton.
 * Processes "ai-analysis" jobs entirely off the request thread:
 *
 *   POST /api/reports  ──► save to DB ──► enqueue job ──► 202 Accepted
 *                                              │
 *                                    [jobQueue worker picks up]
 *                                              │
 *                                    run AI validation (OpenAI)
 *                                              │
 *                                    update report in DB
 *                                              │
 *                                    pubSub.publish(AI_ANALYSIS_COMPLETE)
 *                                              │
 *                                    WebSocket → all clients
 *
 * Retry: up to 3 attempts with exponential back-off (handled by JobQueue).
 * Idempotency: the job carries reportId; the handler is a pure DB+AI call.
 */

import { jobQueue } from "../utils/jobQueue";
import { pubSub, CHANNELS } from "../utils/pubsub";
import { AIValidationService } from "../validators/aiValidation";
import { storage } from "../db/storage";
import { logger } from "../utils/logger";
import { db } from "../db/db";
import { disasterReports } from "@shared/schema";
import { eq } from "drizzle-orm";
import { signalFusionService } from "../modules/ai/signal-fusion.service";

// ── Job payload types ──────────────────────────────────────────────────────

export interface AIAnalysisJobData {
  reportId:  string;
  userId:    string;
  enqueuedAt: string; // ISO timestamp for latency tracking
}

export interface AIAnalysisResult {
  reportId:          string;
  aiValidationScore: number;
  aiValidationNotes: string;
  isDuplicate:       boolean;
  isSuspicious:      boolean;
  processingMs:      number;
  enqueuedAt:        string;
}

// ── Worker metrics (in-process, reset on restart) ─────────────────────────

export const workerMetrics = {
  processed: 0,
  failed:    0,
  totalMs:   0,
  get avgMs() {
    return this.processed > 0 ? Math.round(this.totalMs / this.processed) : 0;
  },
  recent: [] as Array<{ reportId: string; ms: number; score: number; at: string }>,
};

const aiService = new AIValidationService();

// ── Handler ────────────────────────────────────────────────────────────────

async function handleAIAnalysis(data: AIAnalysisJobData): Promise<void> {
  const start = Date.now();
  const { reportId, enqueuedAt } = data;

  logger.info("[AI Worker] Starting analysis", { reportId });

  // 1. Fetch the report
  const report = await storage.getDisasterReport(reportId);
  if (!report) {
    throw new Error(`Report ${reportId} not found — skipping AI analysis`);
  }

  // Idempotency guard: already processed
  if (report.aiValidationScore !== null) {
    logger.info("[AI Worker] Report already has AI score — skipping", { reportId });
    return;
  }

  // 2. Fetch recent reports for duplicate detection context
  const recentReports = await storage.getRecentReports(200);

  // 3. Run AI validation (the expensive call)
  const aiResult = await aiService.validateReport(
    {
      title:       report.title,
      description: report.description,
      type:        report.type,
      severity:    report.severity,
      location:    report.location,
      latitude:    report.latitude,
      longitude:   report.longitude,
    },
    recentReports
  );

  // 4. Persist results back to the report
  await db.update(disasterReports)
    .set({
      aiValidationScore: aiResult.score,
      aiValidationNotes: aiResult.notes,
      updatedAt: new Date(),
    })
    .where(eq(disasterReports.id, reportId));

  // 4b. §22 — Save feature vector to feature store (fire-and-forget)
  signalFusionService.computeFeatureVector(
    aiResult.score / 100,   // normalize 0–100 → 0–1
    {
      latitude:  report.latitude  ?? undefined,
      longitude: report.longitude ?? undefined,
      userId:    report.userId    ?? undefined,
      type:      report.type,
      reportId,
    }
  ).catch(() => {});

  const processingMs = Date.now() - start;

  // 5. Track metrics
  workerMetrics.processed++;
  workerMetrics.totalMs += processingMs;
  workerMetrics.recent.unshift({ reportId, ms: processingMs, score: aiResult.score, at: new Date().toISOString() });
  if (workerMetrics.recent.length > 20) workerMetrics.recent.pop();

  const result: AIAnalysisResult = {
    reportId,
    aiValidationScore: aiResult.score,
    aiValidationNotes: aiResult.notes,
    isDuplicate:       aiResult.isDuplicate,
    isSuspicious:      aiResult.isSuspicious,
    processingMs,
    enqueuedAt,
  };

  // 6. Publish result → WebSocket layer picks it up via pubSub subscriber
  await pubSub.publish(CHANNELS.AI_ANALYSIS_COMPLETE, result);

  logger.info("[AI Worker] Analysis complete", {
    reportId,
    score:       aiResult.score,
    processingMs,
    queueLatencyMs: Date.now() - new Date(enqueuedAt).getTime(),
  });
}

// ── Error hook ─────────────────────────────────────────────────────────────

async function handleAIAnalysisError(data: AIAnalysisJobData, error: Error): Promise<void> {
  workerMetrics.failed++;
  await pubSub.publish(CHANNELS.AI_ANALYSIS_FAILED, {
    reportId: data.reportId,
    error:    error.message,
    at:       new Date().toISOString(),
  });
  logger.error("[AI Worker] Analysis failed permanently", error, { reportId: data.reportId });
}

// ── Registration ───────────────────────────────────────────────────────────

export function registerAIAnalysisWorker(): void {
  jobQueue.registerHandler<AIAnalysisJobData>("ai-analysis", async (data) => {
    try {
      await handleAIAnalysis(data);
    } catch (err) {
      // Let jobQueue retry; publish failure only after max retries hit
      // (the queue calls our handler again on retry, so we re-throw)
      throw err;
    }
  });

  logger.info("[AI Worker] Registered ai-analysis handler on jobQueue");
}

// ── Enqueue helper (called from controller) ────────────────────────────────

export async function enqueueAIAnalysis(reportId: string, userId: string, priority = 0): Promise<string> {
  const jobData: AIAnalysisJobData = {
    reportId,
    userId,
    enqueuedAt: new Date().toISOString(),
  };

  const jobId = await jobQueue.enqueue<AIAnalysisJobData>(
    "ai-analysis",
    jobData,
    { priority, maxRetries: 3 }
  );

  logger.info("[AI Worker] Enqueued ai-analysis job", { reportId, jobId, priority });
  return jobId;
}
