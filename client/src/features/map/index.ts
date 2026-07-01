// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  MapIncident, MapFilters, RoutePolyline, HeatmapPoint, DisasterType,
} from "./types/map.types";

// ── Services ──────────────────────────────────────────────────────────────────
export { fetchRoute, fetchRiskZones, reverseGeocode } from "./services/geo.api";

// ── Hooks ─────────────────────────────────────────────────────────────────────
export { useMapFilters }     from "./hooks/useMapFilters";
export { useSelectIncident } from "./hooks/useMapSync";
export { useCommandCenter }  from "./store/map.store";

// ── Stable selectors ──────────────────────────────────────────────────────────
export {
  selectSelectedIncident,
  selectRoutes,
} from "@/store/commandCenterStore";

// ── Components (from existing map components) ─────────────────────────────────
export { IncidentPanel } from "@/components/map/IncidentPanel";
