import { getCircuitBreaker } from "../resilience/circuit-breaker";
import { withRetry } from "../resilience/retry";
import { logger } from "../../utils/logger";

interface ReverseGeocodeResult {
  displayName: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  source: "nominatim" | "fallback";
}

interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  summary: string;
}

const geocodeCache = new Map<string, { result: ReverseGeocodeResult; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cb = getCircuitBreaker("maps-nominatim", { failureThreshold: 3, timeout: 60_000 });

function cacheKey(lat: string, lng: string) { return `${parseFloat(lat).toFixed(4)},${parseFloat(lng).toFixed(4)}`; }

export async function reverseGeocode(lat: string, lng: string): Promise<ReverseGeocodeResult> {
  const key = cacheKey(lat, lng);
  const cached = geocodeCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    logger.info(`[Maps] Cache hit for ${key}`);
    return cached.result;
  }

  const fallback = (): ReverseGeocodeResult => ({
    displayName: `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`,
    source: "fallback",
  });

  const result = await cb.execute<ReverseGeocodeResult>(async () => {
    return withRetry<ReverseGeocodeResult>(async () => {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
      const res = await fetch(url, {
        headers: { "User-Agent": "CrisisConnect/1.0 (emergency-platform)" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);
      const data = await res.json();
      return {
        displayName: data.display_name || fallback().displayName,
        city: data.address?.city || data.address?.town || data.address?.village,
        state: data.address?.state,
        country: data.address?.country,
        countryCode: data.address?.country_code?.toUpperCase(),
        source: "nominatim" as const,
      };
    }, { attempts: 2, baseDelayMs: 300 });
  }, fallback);

  geocodeCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

export async function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): Promise<RouteResult> {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const durationMinutes = Math.round((distanceKm / 50) * 60);
  return {
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    durationMinutes,
    summary: `${distanceKm.toFixed(1)} km — approx ${durationMinutes} min by road`,
  };
}

export function getCacheStats() {
  const valid = [...geocodeCache.values()].filter(v => Date.now() < v.expiresAt).length;
  return { totalEntries: geocodeCache.size, validEntries: valid, circuitBreaker: cb.getStatus() };
}
