/**
 * §26 — Durable Event Store
 *
 * Wraps the existing fire-and-forget pub/sub with a PostgreSQL persistence layer.
 * Every event is:
 *   1. Assigned a standardized envelope (id, eventType, entityId, payload, ts, version)
 *   2. Persisted to the domain_events table (survives crashes, replayable)
 *   3. Published to pubSub for real-time fan-out (existing behavior preserved)
 *
 * Consumer groups:
 *   - Consumers call markProcessed(eventId, consumerId) to record their offset
 *   - The processedBy JSONB array tracks which consumers have handled each event
 *   - Replay: query events after a given offset for consumers that missed them
 *
 * Envelope format (standardized):
 *   { id, eventId, eventType, entityId, entityType, payload, version, ts, createdAt }
 */

import { db } from "../../db/db";
import { domainEvents } from "@shared/schema";
import { eq, gte, desc, and, sql, inArray } from "drizzle-orm";
import { pubSub } from "../../utils/pubsub";
import { logger } from "../../utils/logger";
import { randomUUID } from "crypto";

// ── Standardized Event Envelope ───────────────────────────────────────────────

export interface EventEnvelope {
  id:         string;       // DB primary key (UUID)
  eventId:    string;       // Client idempotency key (UUID)
  eventType:  string;       // e.g. "report.created", "decision.executed"
  entityId?:  string;       // e.g. reportId, decisionId
  entityType?: string;      // e.g. "report", "decision"
  payload:    Record<string, unknown>;
  version:    number;       // schema version — allows consumers to handle migrations
  ts:         number;       // Unix ms timestamp
  createdAt:  string;       // ISO string
  processedBy: string[];    // consumer IDs that have acked this event
}

export interface AppendOptions {
  eventType:   string;
  entityId?:   string;
  entityType?: string;
  payload:     Record<string, unknown>;
  version?:    number;
  idempotencyKey?: string; // if provided, deduplicates by this key
}

export interface ReplayOptions {
  eventType?:  string;
  entityId?:   string;
  since?:      Date;       // replay from this timestamp
  fromOffset?: string;     // replay from this event ID (exclusive)
  limit?:      number;
  consumerId?: string;     // if set, only return events not yet processed by this consumer
}

// ── Event Type Catalogue ──────────────────────────────────────────────────────

export const EVENT_TYPES = {
  REPORT_CREATED:         "report.created",
  REPORT_UPDATED:         "report.updated",
  AI_ANALYSIS_COMPLETE:   "ai.analysis.complete",
  AI_ANALYSIS_FAILED:     "ai.analysis.failed",
  DECISION_CREATED:       "decision.created",
  DECISION_EXECUTED:      "decision.executed",
  DECISION_REJECTED:      "decision.rejected",
  OUTCOME_RECORDED:       "outcome.recorded",
  PREDICTION_GENERATED:   "prediction.generated",
  PREDICTION_ACTIONED:    "prediction.actioned",
  SPIKE_DETECTED:         "signal.spike_detected",
  SOS_ACTIVATED:          "sos.activated",
  SOS_RESOLVED:           "sos.resolved",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// ── Service ───────────────────────────────────────────────────────────────────

class EventStoreService {
  private appendCount = 0;
  private replayCount = 0;

  /**
   * Append an event to the durable store and publish it on pubSub.
   * Idempotent: if idempotencyKey is provided and matches an existing event, returns the existing record.
   */
  async append(opts: AppendOptions): Promise<EventEnvelope> {
    const {
      eventType, entityId, entityType, payload,
      version = 1, idempotencyKey,
    } = opts;

    const eventId = idempotencyKey ?? randomUUID();

    // Idempotency check
    if (idempotencyKey) {
      const [existing] = await db
        .select()
        .from(domainEvents)
        .where(eq(domainEvents.eventId, idempotencyKey))
        .limit(1);

      if (existing) {
        return this.toEnvelope(existing);
      }
    }

    const [saved] = await db
      .insert(domainEvents)
      .values({
        eventId,
        eventType,
        entityId:    entityId ?? null,
        entityType:  entityType ?? null,
        payload,
        version,
        processedBy: [],
      })
      .returning();

    this.appendCount++;

    const envelope = this.toEnvelope(saved);

    // Publish to real-time pub/sub for live subscribers
    pubSub.publish(`event:${eventType}`, envelope).catch(() => {});
    pubSub.publish("event:*", envelope).catch(() => {});

    logger.debug(`[EventStore] Appended ${eventType}`, {
      eventId,
      entityId,
      appendCount: this.appendCount,
    });

    return envelope;
  }

  /**
   * Mark an event as processed by a specific consumer.
   * Used for consumer group tracking — consumers call this after handling an event.
   */
  async markProcessed(eventId: string, consumerId: string): Promise<void> {
    await db
      .update(domainEvents)
      .set({
        processedBy: sql`jsonb_set(
          COALESCE(processed_by, '[]'::jsonb),
          array[jsonb_array_length(COALESCE(processed_by, '[]'::jsonb))::text],
          ${JSON.stringify(consumerId)}::jsonb
        )`,
      })
      .where(eq(domainEvents.eventId, eventId));
  }

  /**
   * Replay events — returns events matching the given criteria.
   * Enables consumers to recover from crashes by replaying missed events.
   */
  async replay(opts: ReplayOptions = {}): Promise<EventEnvelope[]> {
    const {
      eventType, entityId, since, limit = 100, consumerId,
    } = opts;

    const conditions = [];

    if (eventType) conditions.push(eq(domainEvents.eventType, eventType));
    if (entityId)  conditions.push(eq(domainEvents.entityId, entityId));
    if (since)     conditions.push(gte(domainEvents.createdAt, since));

    // If consumerId provided, only return events not yet processed by this consumer
    if (consumerId) {
      conditions.push(
        sql`NOT (processed_by @> ${JSON.stringify([consumerId])}::jsonb)`
      );
    }

    const rows = await db
      .select()
      .from(domainEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(domainEvents.createdAt)
      .limit(Math.min(limit, 500));

    this.replayCount++;

    logger.debug(`[EventStore] Replayed ${rows.length} events`, {
      eventType,
      entityId,
      consumerId,
      replayCount: this.replayCount,
    });

    return rows.map(r => this.toEnvelope(r));
  }

  /**
   * Get recent events for the dashboard feed.
   */
  async getRecent(limit = 50): Promise<EventEnvelope[]> {
    const rows = await db
      .select()
      .from(domainEvents)
      .orderBy(desc(domainEvents.createdAt))
      .limit(Math.min(limit, 200));

    return rows.map(r => this.toEnvelope(r));
  }

  /**
   * Get event counts grouped by type.
   */
  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    appendCount: number;
    replayCount: number;
    oldestEvent: string | null;
  }> {
    const rows = await db
      .select({
        eventType: domainEvents.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(domainEvents)
      .groupBy(domainEvents.eventType)
      .orderBy(desc(sql`count(*)`));

    const [oldest] = await db
      .select({ createdAt: domainEvents.createdAt })
      .from(domainEvents)
      .orderBy(domainEvents.createdAt)
      .limit(1);

    const byType: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      byType[row.eventType] = Number(row.count);
      total += Number(row.count);
    }

    return {
      total,
      byType,
      appendCount: this.appendCount,
      replayCount: this.replayCount,
      oldestEvent: oldest?.createdAt?.toISOString() ?? null,
    };
  }

  private toEnvelope(row: any): EventEnvelope {
    return {
      id:          row.id,
      eventId:     row.eventId,
      eventType:   row.eventType,
      entityId:    row.entityId ?? undefined,
      entityType:  row.entityType ?? undefined,
      payload:     row.payload as Record<string, unknown>,
      version:     row.version,
      ts:          new Date(row.createdAt).getTime(),
      createdAt:   new Date(row.createdAt).toISOString(),
      processedBy: (row.processedBy as string[]) ?? [],
    };
  }
}

export const eventStore = new EventStoreService();
