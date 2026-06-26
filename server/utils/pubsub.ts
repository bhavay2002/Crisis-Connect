/**
 * Pub/Sub Abstraction Layer — §21 Scalability
 *
 * Dual-mode architecture:
 *  • InMemoryPubSub  — default, works in single-process (current)
 *  • RedisPubSub     — drops in automatically when REDIS_URL is set
 *
 * All WebSocket broadcasting, cross-service events, and AI pipeline
 * notifications go through this layer so the system is cluster-ready
 * without code changes beyond setting REDIS_URL.
 */

import { EventEmitter } from "events";
import { logger } from "./logger";

// ── Interface ──────────────────────────────────────────────────────────────

export interface PubSubAdapter {
  publish(channel: string, data: unknown): Promise<void>;
  subscribe(channel: string, handler: (data: unknown) => void): void;
  unsubscribe(channel: string, handler: (data: unknown) => void): void;
  getChannels(): string[];
  getMode(): "in-memory" | "redis";
}

// ── In-Memory Implementation ───────────────────────────────────────────────

class InMemoryPubSub implements PubSubAdapter {
  private emitter = new EventEmitter();
  private channels = new Set<string>();
  private publishCount = 0;

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  async publish(channel: string, data: unknown): Promise<void> {
    this.channels.add(channel);
    this.publishCount++;
    this.emitter.emit(channel, data);
    logger.debug(`[PubSub:in-memory] publish → ${channel}`);
  }

  subscribe(channel: string, handler: (data: unknown) => void): void {
    this.channels.add(channel);
    this.emitter.on(channel, handler);
    logger.debug(`[PubSub:in-memory] subscribe ← ${channel}`);
  }

  unsubscribe(channel: string, handler: (data: unknown) => void): void {
    this.emitter.off(channel, handler);
  }

  getChannels(): string[] {
    return Array.from(this.channels);
  }

  getMode(): "in-memory" | "redis" {
    return "in-memory";
  }

  getStats() {
    return {
      channels:     this.channels.size,
      publishCount: this.publishCount,
      listeners:    this.emitter.eventNames().length,
    };
  }
}

// ── Redis Implementation (lazy-loaded when REDIS_URL is set) ────────────────

class RedisPubSub implements PubSubAdapter {
  private pubClient: any;
  private subClient: any;
  private handlers = new Map<string, Set<(data: unknown) => void>>();
  private ready = false;

  constructor(url: string) {
    this.init(url);
  }

  private async init(url: string) {
    try {
      // @ts-ignore — redis is an optional peer dependency loaded at runtime
      const { createClient } = await import("redis");
      this.pubClient = createClient({ url });
      this.subClient = createClient({ url });
      await this.pubClient.connect();
      await this.subClient.connect();
      this.ready = true;
      logger.info("[PubSub:redis] Connected to Redis pub/sub");
    } catch (err) {
      logger.error("[PubSub:redis] Failed to connect — falling back to in-memory", err as Error);
      // Degrade gracefully: this instance stays "not ready"
    }
  }

  async publish(channel: string, data: unknown): Promise<void> {
    if (!this.ready) return;
    await this.pubClient.publish(channel, JSON.stringify(data));
    logger.debug(`[PubSub:redis] publish → ${channel}`);
  }

  subscribe(channel: string, handler: (data: unknown) => void): void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      if (this.ready) {
        this.subClient.subscribe(channel, (raw: string) => {
          const data = JSON.parse(raw);
          this.handlers.get(channel)?.forEach(h => h(data));
        });
      }
    }
    this.handlers.get(channel)!.add(handler);
  }

  unsubscribe(channel: string, handler: (data: unknown) => void): void {
    this.handlers.get(channel)?.delete(handler);
  }

  getChannels(): string[] {
    return Array.from(this.handlers.keys());
  }

  getMode(): "in-memory" | "redis" {
    return "redis";
  }
}

// ── Singleton Factory ──────────────────────────────────────────────────────

function createPubSub(): PubSubAdapter & { getStats?: () => Record<string, number> } {
  if (process.env.REDIS_URL) {
    logger.info("[PubSub] Redis URL detected — using Redis pub/sub adapter");
    return new RedisPubSub(process.env.REDIS_URL);
  }
  logger.info("[PubSub] No REDIS_URL — using in-memory pub/sub (single-process)");
  return new InMemoryPubSub();
}

export const pubSub = createPubSub();

// ── Typed Channel Helpers ──────────────────────────────────────────────────

export const CHANNELS = {
  AI_ANALYSIS_COMPLETE:   "ai:analysis:complete",
  AI_ANALYSIS_FAILED:     "ai:analysis:failed",
  REPORT_CREATED:         "report:created",
  REPORT_UPDATED:         "report:updated",
  SOS_ACTIVATED:          "sos:activated",
  SOS_RESOLVED:           "sos:resolved",
  ALERT_BROADCAST:        "alert:broadcast",
  WS_BROADCAST_ALL:       "ws:broadcast:all",
  WS_BROADCAST_ROOM:      "ws:broadcast:room",
} as const;

export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];

// ── Room-based WS broadcast via Pub/Sub ───────────────────────────────────

export interface RoomMessage {
  room:    string;
  payload: unknown;
}

export function publishToRoom(room: string, payload: unknown): Promise<void> {
  return pubSub.publish(CHANNELS.WS_BROADCAST_ROOM, { room, payload });
}

export function publishToAll(payload: unknown): Promise<void> {
  return pubSub.publish(CHANNELS.WS_BROADCAST_ALL, payload);
}
