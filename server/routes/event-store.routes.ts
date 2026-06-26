/**
 * §26 — Durable Event Store API
 * Exposes replay, stats, and live event feed endpoints.
 */

import type { Express } from "express";
import { eventStore, EVENT_TYPES } from "../modules/events/event-store.service";
import { authenticateToken } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { logger } from "../utils/logger";

export function registerEventStoreRoutes(app: Express) {
  // ── GET /api/events/recent ────────────────────────────────────────────────
  app.get("/api/events/recent", authenticateToken, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const events = await eventStore.getRecent(limit);
      res.json({ events, count: events.length });
    } catch (err) {
      logger.error("Failed to fetch recent events", err as Error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // ── GET /api/events/stats ─────────────────────────────────────────────────
  app.get("/api/events/stats", authenticateToken, async (_req, res) => {
    try {
      const stats = await eventStore.getStats();
      res.json({
        ...stats,
        catalogue: Object.values(EVENT_TYPES),
        durability: "postgresql",
        replayable: true,
        consumerGroups: true,
      });
    } catch (err) {
      logger.error("Failed to fetch event stats", err as Error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ── GET /api/events/replay ────────────────────────────────────────────────
  // Replay events for a consumer that missed them
  // Query params: eventType, entityId, since (ISO), consumerId, limit
  app.get(
    "/api/events/replay",
    authenticateToken,
    requireRole("admin", "authority", "super_admin"),
    async (req, res) => {
      try {
        const {
          eventType, entityId, since, consumerId,
          limit: limitStr = "100",
        } = req.query as Record<string, string>;

        const events = await eventStore.replay({
          eventType:  eventType || undefined,
          entityId:   entityId  || undefined,
          since:      since ? new Date(since) : undefined,
          consumerId: consumerId || undefined,
          limit:      Math.min(parseInt(limitStr) || 100, 500),
        });

        res.json({
          events,
          count:       events.length,
          replayedAt:  new Date().toISOString(),
          filters: { eventType, entityId, since, consumerId },
        });
      } catch (err) {
        logger.error("Failed to replay events", err as Error);
        res.status(500).json({ message: "Failed to replay events" });
      }
    }
  );

  // ── POST /api/events/:eventId/ack ─────────────────────────────────────────
  // Consumer acknowledges processing of an event
  app.post(
    "/api/events/:eventId/ack",
    authenticateToken,
    requireRole("admin", "authority", "super_admin"),
    async (req: any, res) => {
      try {
        const { eventId } = req.params;
        const { consumerId } = req.body;

        if (!consumerId) {
          return res.status(400).json({ message: "consumerId is required" });
        }

        await eventStore.markProcessed(eventId, consumerId);
        res.json({ ok: true, eventId, consumerId, ackedAt: new Date().toISOString() });
      } catch (err) {
        logger.error("Failed to ack event", err as Error);
        res.status(500).json({ message: "Failed to acknowledge event" });
      }
    }
  );

  // ── GET /api/events/catalogue ─────────────────────────────────────────────
  app.get("/api/events/catalogue", authenticateToken, (_req, res) => {
    res.json({
      eventTypes: Object.entries(EVENT_TYPES).map(([key, value]) => ({
        key, type: value,
        description: EVENT_TYPE_DESCRIPTIONS[value] ?? "System event",
      })),
      envelope: {
        id:          "DB primary key (UUID)",
        eventId:     "Client idempotency key (UUID)",
        eventType:   "Dotted string e.g. report.created",
        entityId:    "ID of the primary entity (optional)",
        entityType:  "Entity class e.g. report, decision (optional)",
        payload:     "Arbitrary JSONB payload",
        version:     "Schema version — enables consumer migration",
        ts:          "Unix ms timestamp",
        processedBy: "Array of consumer IDs that have acked this event",
      },
      durability:   "PostgreSQL — survives process restarts",
      replayWindow: "All events retained (no TTL)",
    });
  });
}

const EVENT_TYPE_DESCRIPTIONS: Record<string, string> = {
  "report.created":         "A new disaster report was submitted by a user or sensor",
  "report.updated":         "A disaster report was updated (status, AI score, etc.)",
  "ai.analysis.complete":   "AI analysis of a report finished successfully",
  "ai.analysis.failed":     "AI analysis of a report failed after retries",
  "decision.created":       "The decision engine generated a new recommended action",
  "decision.executed":      "A decision was approved and executed by an operator",
  "decision.rejected":      "A decision was rejected by an operator with reason",
  "outcome.recorded":       "The real-world outcome of a decision was recorded",
  "prediction.generated":   "The prediction engine completed a batch run",
  "prediction.actioned":    "A prediction triggered an auto-PREDEPLOY decision",
  "signal.spike_detected":  "A zone crossed the report spike threshold (≥3 in 15min)",
  "sos.activated":          "An SOS beacon was activated",
  "sos.resolved":           "An SOS situation was resolved",
};
