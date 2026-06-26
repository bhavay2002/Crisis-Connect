/**
 * Service Health & Architecture Layer — §22 Strangler Fig Pattern
 *
 * Defines logical service boundaries for the CrisisConnect monolith
 * and exposes per-service metrics. This is the observability layer that
 * makes the architecture explicit before physical service extraction.
 *
 * Migration path (Strangler Fig):
 *   Phase 1 (current) — Modular monolith with explicit boundaries
 *   Phase 2           — Extract AI Service → isolated process behind /api/ai proxy
 *   Phase 3           — Extract Realtime Service → WS nodes + Redis adapter
 *   Phase 4           — Extract Analytics Service → read replicas + CQRS
 *   Phase 5           — Core API (auth, RBAC, orchestration) remains as BFF
 */

import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { jobQueue } from "../utils/jobQueue";
import { pubSub, CHANNELS } from "../utils/pubsub";
import { adaptiveWeights } from "../modules/fusion/adaptive-weights.service";
import { workerMetrics } from "../workers/ai-analysis.worker";

// ── Per-service in-process metric counters ─────────────────────────────────

interface ServiceMetrics {
  requests:   number;
  errors:     number;
  totalMs:    number;
  lastCalledAt: string | null;
}

const serviceMetrics: Record<string, ServiceMetrics> = {
  "ai-service":        { requests: 0, errors: 0, totalMs: 0, lastCalledAt: null },
  "realtime-service":  { requests: 0, errors: 0, totalMs: 0, lastCalledAt: null },
  "analytics-service": { requests: 0, errors: 0, totalMs: 0, lastCalledAt: null },
  "fusion-service":    { requests: 0, errors: 0, totalMs: 0, lastCalledAt: null },
  "core-api":          { requests: 0, errors: 0, totalMs: 0, lastCalledAt: null },
};

export function recordServiceCall(service: string, ms: number, isError = false) {
  if (!serviceMetrics[service]) return;
  const m = serviceMetrics[service];
  m.requests++;
  m.totalMs += ms;
  m.lastCalledAt = new Date().toISOString();
  if (isError) m.errors++;
}

const SERVICE_DEFS = [
  {
    id:          "ai-service",
    name:        "AI Service",
    description: "AI analysis, feature extraction, XAI explanations, signal fusion",
    routes:      ["/api/ai/*", "/api/system/pipeline"],
    owns:        ["aiValidation", "signalFusion", "crisisIntelligence", "ragKnowledge"],
    extractionPhase: 2,
    extractionNotes: "Already async via JobQueue → easiest to isolate. Extract to separate process behind /api/ai proxy.",
    status: "monolith-boundary",
  },
  {
    id:          "realtime-service",
    name:        "Realtime Service",
    description: "WebSocket connections, pub/sub, presence, room-based broadcasting",
    routes:      ["/ws", "/api/events/*"],
    owns:        ["websocket", "pubsub", "eventBus", "broadcastToAll"],
    extractionPhase: 3,
    extractionNotes: "Needs Redis adapter before extraction. Set REDIS_URL → pub/sub becomes multi-instance safe.",
    status: "monolith-boundary",
  },
  {
    id:          "analytics-service",
    name:        "Analytics Service",
    description: "Metrics aggregation, dashboards, prediction, reporting",
    routes:      ["/api/analytics/*", "/api/executive/*", "/api/api-analytics/*"],
    owns:        ["analyticsEvents", "predictions", "incidentMetrics"],
    extractionPhase: 4,
    extractionNotes: "Can become a read-only CQRS replica consuming events from core-api via pub/sub.",
    status: "monolith-boundary",
  },
  {
    id:          "fusion-service",
    name:        "Fusion Service",
    description: "Adaptive signal fusion, feature store, outcome collection, model versioning",
    routes:      ["/api/fusion/*"],
    owns:        ["signalFeatures", "signalOutcomes", "modelWeights", "adaptiveWeights"],
    extractionPhase: 2,
    extractionNotes: "Shares DB with AI service initially. Move to per-service DB after data ownership is clear.",
    status: "monolith-boundary",
  },
  {
    id:          "core-api",
    name:        "Core API",
    description: "Auth, RBAC, report lifecycle, resource management, orchestration",
    routes:      ["/api/auth/*", "/api/reports/*", "/api/resources/*", "/api/admin/*"],
    owns:        ["users", "reports", "resources", "organizations", "decisions"],
    extractionPhase: 5,
    extractionNotes: "Remains as BFF (backend-for-frontend). All other services evolve first.",
    status: "monolith-boundary",
  },
];

const EVENT_CONTRACTS = [
  { event: "report.created",  schema: '{ reportId, userId, type, severity, location }',       producer: "core-api",     consumers: ["ai-service", "fusion-service", "analytics-service"] },
  { event: "report.enriched", schema: '{ reportId, features, fusedScore, modelVersion }',      producer: "fusion-service", consumers: ["core-api", "realtime-service"] },
  { event: "decision.created",schema: '{ decisionId, reportId, action, confidence, reason }',  producer: "core-api",     consumers: ["realtime-service", "analytics-service"] },
  { event: "ai.completed",    schema: '{ reportId, aiScore, notes, processingMs }',            producer: "ai-service",   consumers: ["fusion-service", "realtime-service"] },
  { event: "outcome.labeled", schema: '{ reportId, isRealCrisis, labelSource }',               producer: "fusion-service", consumers: ["ai-service"] },
];

export function registerServiceHealthRoutes(app: Express) {

  // ── Full architecture map ─────────────────────────────────────────────────
  app.get("/api/services/health", isAuthenticated, requireRole("admin", "super_admin"), (_req, res) => {
    const w = adaptiveWeights.getWeights();
    const qStatus = jobQueue.getQueueStatus();

    res.json({
      architecture: "modular-monolith-with-explicit-boundaries",
      migrationPattern: "strangler-fig",
      currentPhase: 1,
      services: SERVICE_DEFS.map(svc => {
        const m = serviceMetrics[svc.id];
        return {
          ...svc,
          metrics: {
            requests:    m.requests,
            errors:      m.errors,
            errorRate:   m.requests > 0 ? parseFloat(((m.errors / m.requests) * 100).toFixed(1)) : 0,
            avgLatencyMs: m.requests > 0 ? Math.round(m.totalMs / m.requests) : 0,
            lastCalledAt: m.lastCalledAt,
          },
        };
      }),
      eventContracts: EVENT_CONTRACTS,
      pubsub: {
        mode: pubSub.getMode(),
        channels: pubSub.getChannels(),
        redisReady: pubSub.getMode() === "redis",
        multiInstanceReady: pubSub.getMode() === "redis",
      },
      aiPipeline: {
        async: true,
        queueBackend: "in-memory-jobqueue",
        concurrency: qStatus.concurrency,
        processed: workerMetrics.processed,
        avgLatencyMs: workerMetrics.avgMs,
      },
      adaptiveFusion: {
        modelVersion: w.version,
        sampleCount:  w.sampleCount,
        ready:        adaptiveWeights.isReady(),
      },
      migrationRoadmap: {
        phase1: "✅ Current — modular monolith with explicit service boundaries",
        phase2: "🔜 Extract AI + Fusion services → separate processes (requires: Docker, process manager)",
        phase3: "🔜 Extract Realtime → WS cluster (requires: REDIS_URL set for pub/sub)",
        phase4: "🔜 Extract Analytics → CQRS read replica (requires: event streaming)",
        phase5: "🔜 Core API becomes BFF + API gateway (requires: service mesh or Kong/Nginx)",
      },
      generatedAt: new Date().toISOString(),
    });
  });
}
