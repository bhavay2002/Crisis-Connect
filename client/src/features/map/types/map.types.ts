import type { Severity, LatLng } from "@/shared/types/common.types";

export type DisasterType =
  | "fire" | "flood" | "earthquake" | "storm" | "road_accident"
  | "epidemic" | "landslide" | "gas_leak" | "building_collapse"
  | "chemical_spill" | "power_outage" | "water_contamination" | "other";

export interface MapIncident {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type: DisasterType;
  severity: Severity;
  status: string;
  location: string;
  description: string;
  verificationCount: number;
  createdAt: string;
  aiValidationScore?: number | null;
  confirmedBy?: string | null;
}

export interface MapFilters {
  type: string;
  severity: string;
  timeRange: string;
}

export interface RoutePolyline {
  incidentId: string;
  points: [number, number][];
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}
