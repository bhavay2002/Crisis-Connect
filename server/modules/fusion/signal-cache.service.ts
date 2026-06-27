/**
 * §27 — External Signal Resilience Cache
 *
 * Wraps DataFusionService.getLiveFusionSignals() with a TTL cache.
 * When serving from cache, responses include:
 *   - stale: true
 *   - cacheAgeSeconds: number
 *   - lastFetchedAt: ISO string
 *   - source: "cache" | "live"
 *
 * Per-source freshness is tracked independently so a weather API failure
 * doesn't degrade social or IoT signals (bulkhead isolation).
 */

import { getLiveFusionSignals, analyzeReportFusion, type FusionResult } from "./data-fusion.service";
import { logger } from "../../utils/logger";

interface CacheEntry<T> {
  data:          T;
  fetchedAt:     number;  // Unix ms
  ttlMs:         number;
  source:        "live" | "cache";
}

interface CachedFusionResult extends FusionResult {
  stale:           boolean;
  cacheAgeSeconds: number;
  lastFetchedAt:   string;
  dataSource:      "live" | "cache";
}

// ── TTL configuration per signal source ──────────────────────────────────────
// Different sources have different acceptable staleness windows

const TTL = {
  liveSignals:  5 * 60 * 1000,   // 5 minutes — full signal list
  perReport:    3 * 60 * 1000,   // 3 minutes — per-report fusion
  fusionStats:  2 * 60 * 1000,   // 2 minutes — aggregate stats
};

// ── In-memory cache stores ───────────────────────────────────────────────────

const liveSignalsCache = new Map<string, CacheEntry<FusionResult[]>>();  // key = `live:${limit}`
const perReportCache   = new Map<string, CacheEntry<FusionResult>>();    // key = reportId

// Per-source freshness tracking
const sourceFreshness = new Map<string, { lastSuccessAt: number; failureCount: number }>();

function isStale<T>(entry: CacheEntry<T>): boolean {
  return Date.now() - entry.fetchedAt > entry.ttlMs;
}

function cacheAgeSeconds<T>(entry: CacheEntry<T>): number {
  return Math.round((Date.now() - entry.fetchedAt) / 1000);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getCachedFusionSignals(limit = 20): Promise<{
  results:         CachedFusionResult[];
  stale:           boolean;
  cacheAgeSeconds: number;
  lastFetchedAt:   string | null;
  dataSource:      "live" | "cache";
}> {
  const cacheKey = `live:${limit}`;
  const cached   = liveSignalsCache.get(cacheKey);

  // Serve fresh data if cache is valid
  if (cached && !isStale(cached)) {
    const age = cacheAgeSeconds(cached);
    return {
      results:         enrichResults(cached.data, false, age, "live"),
      stale:           false,
      cacheAgeSeconds: age,
      lastFetchedAt:   new Date(cached.fetchedAt).toISOString(),
      dataSource:      "live",
    };
  }

  // Attempt to fetch fresh data
  try {
    const fresh = await getLiveFusionSignals(limit);

    liveSignalsCache.set(cacheKey, {
      data:      fresh,
      fetchedAt: Date.now(),
      ttlMs:     TTL.liveSignals,
      source:    "live",
    });

    recordSourceSuccess("live_signals");

    return {
      results:         enrichResults(fresh, false, 0, "live"),
      stale:           false,
      cacheAgeSeconds: 0,
      lastFetchedAt:   new Date().toISOString(),
      dataSource:      "live",
    };
  } catch (err) {
    recordSourceFailure("live_signals");
    logger.warn("[SignalCache] Live fetch failed — serving stale cache", { error: String(err) });

    // Serve stale data if available (degraded mode)
    if (cached) {
      const age = cacheAgeSeconds(cached);
      logger.warn("[SignalCache] Degraded mode — stale data", { ageSeconds: age, limit });
      return {
        results:         enrichResults(cached.data, true, age, "cache"),
        stale:           true,
        cacheAgeSeconds: age,
        lastFetchedAt:   new Date(cached.fetchedAt).toISOString(),
        dataSource:      "cache",
      };
    }

    // No cache at all — re-throw so caller gets a proper error
    throw err;
  }
}

export async function getCachedReportFusion(reportId: string): Promise<{
  result:          CachedFusionResult | null;
  stale:           boolean;
  cacheAgeSeconds: number;
  dataSource:      "live" | "cache";
}> {
  const cached = perReportCache.get(reportId);

  if (cached && !isStale(cached)) {
    const age = cacheAgeSeconds(cached);
    return {
      result:          enrichSingle(cached.data, false, age, "live"),
      stale:           false,
      cacheAgeSeconds: age,
      dataSource:      "live",
    };
  }

  try {
    const fresh = await analyzeReportFusion(reportId);
    if (!fresh) return { result: null, stale: false, cacheAgeSeconds: 0, dataSource: "live" };

    perReportCache.set(reportId, {
      data:      fresh,
      fetchedAt: Date.now(),
      ttlMs:     TTL.perReport,
      source:    "live",
    });

    return {
      result:          enrichSingle(fresh, false, 0, "live"),
      stale:           false,
      cacheAgeSeconds: 0,
      dataSource:      "live",
    };
  } catch (err) {
    logger.warn("[SignalCache] Per-report fetch failed", { reportId, error: String(err) });

    if (cached) {
      const age = cacheAgeSeconds(cached);
      return {
        result:          enrichSingle(cached.data, true, age, "cache"),
        stale:           true,
        cacheAgeSeconds: age,
        dataSource:      "cache",
      };
    }
    return { result: null, stale: false, cacheAgeSeconds: 0, dataSource: "live" };
  }
}

export function getSignalFreshnessStatus(): {
  sources:     Record<string, { lastSuccessAt: string | null; failureCount: number; healthy: boolean }>;
  cacheEntries: number;
  ttlConfig:   Record<string, number>;
} {
  const sources: Record<string, { lastSuccessAt: string | null; failureCount: number; healthy: boolean }> = {};

  for (const [source, info] of sourceFreshness) {
    sources[source] = {
      lastSuccessAt: info.lastSuccessAt
        ? new Date(info.lastSuccessAt).toISOString()
        : null,
      failureCount: info.failureCount,
      healthy:      info.failureCount === 0 || (Date.now() - (info.lastSuccessAt ?? 0) < 5 * 60 * 1000),
    };
  }

  return {
    sources,
    cacheEntries: liveSignalsCache.size + perReportCache.size,
    ttlConfig: {
      liveSignalsTtlSeconds: TTL.liveSignals / 1000,
      perReportTtlSeconds:   TTL.perReport / 1000,
      fusionStatsTtlSeconds: TTL.fusionStats / 1000,
    },
  };
}

export function invalidateCache(reportId?: string): void {
  if (reportId) {
    perReportCache.delete(reportId);
  } else {
    liveSignalsCache.clear();
    perReportCache.clear();
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

function enrichResults(
  results: FusionResult[],
  stale: boolean,
  ageSeconds: number,
  dataSource: "live" | "cache"
): CachedFusionResult[] {
  return results.map(r => enrichSingle(r, stale, ageSeconds, dataSource)!);
}

function enrichSingle(
  result: FusionResult,
  stale: boolean,
  ageSeconds: number,
  dataSource: "live" | "cache"
): CachedFusionResult {
  return {
    ...result,
    stale,
    cacheAgeSeconds: ageSeconds,
    lastFetchedAt:   new Date(Date.now() - ageSeconds * 1000).toISOString(),
    dataSource,
  };
}

function recordSourceSuccess(source: string): void {
  sourceFreshness.set(source, { lastSuccessAt: Date.now(), failureCount: 0 });
}

function recordSourceFailure(source: string): void {
  const current = sourceFreshness.get(source) ?? { lastSuccessAt: 0, failureCount: 0 };
  sourceFreshness.set(source, {
    lastSuccessAt: current.lastSuccessAt,
    failureCount:  current.failureCount + 1,
  });
}
