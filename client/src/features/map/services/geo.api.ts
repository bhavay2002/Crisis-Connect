import { api } from "@/shared/services/api";
import type { PaginatedResponse } from "@/shared/types/common.types";

export interface RouteResult {
  polyline: [number, number][];
  distance?: number;
  duration?: number;
}

export interface RiskZone {
  lat: number;
  lng: number;
  radius: number;
  riskScore: number;
  type: string;
}

/** Fetch a driving/walking route between two coordinate pairs */
export const fetchRoute = (
  from: [number, number],
  to:   [number, number]
): Promise<RouteResult> =>
  api.get<RouteResult>(`/api/geo/route?from=${from.join(",")}&to=${to.join(",")}`);

/** Fetch AI-computed risk zones for the map */
export const fetchRiskZones = () =>
  api.get<RiskZone[]>("/api/geo/risk-map");

/** Reverse geocode a lat/lng to a human-readable address */
export const reverseGeocode = (lat: number, lng: number) =>
  api.get<{ displayName: string }>(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
