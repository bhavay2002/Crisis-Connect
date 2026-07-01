/**
 * useMapFilters — encapsulates all filter state and derived report list.
 * Pages and components call this; they never manage filter state manually.
 */
import { useState, useMemo } from "react";
import { isWithinInterval } from "date-fns";
import type { MapFilters } from "../types/map.types";

interface Report {
  latitude?: string | null;
  longitude?: string | null;
  type: string;
  severity: string;
  createdAt: string | Date;
}

const DEFAULT_FILTERS: MapFilters = { type: "all", severity: "all", timeRange: "all" };

export function useMapFilters<T extends Report>(reports: T[]) {
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [timelineEnabled, setTimelineEnabled] = useState(false);
  const [timelineRange, setTimelineRange] = useState<{ start: Date; end: Date } | null>(null);

  const filtered = useMemo(() => {
    let f = reports.filter(r => r.latitude != null && r.longitude != null);

    if (filters.type !== "all")     f = f.filter(r => r.type === filters.type);
    if (filters.severity !== "all") f = f.filter(r => r.severity === filters.severity);

    if (timelineEnabled && timelineRange) {
      f = f.filter(r => isWithinInterval(new Date(r.createdAt), timelineRange));
    } else if (filters.timeRange !== "all") {
      const cutoff = new Date();
      if (filters.timeRange === "1h")  cutoff.setHours(cutoff.getHours() - 1);
      if (filters.timeRange === "24h") cutoff.setHours(cutoff.getHours() - 24);
      if (filters.timeRange === "7d")  cutoff.setDate(cutoff.getDate() - 7);
      if (filters.timeRange === "30d") cutoff.setDate(cutoff.getDate() - 30);
      f = f.filter(r => new Date(r.createdAt) >= cutoff);
    }

    return f;
  }, [reports, filters, timelineEnabled, timelineRange]);

  const activeFilterCount = [
    filters.type !== "all",
    filters.severity !== "all",
    filters.timeRange !== "all",
  ].filter(Boolean).length;

  return {
    filters,
    setFilters,
    filtered,
    timelineEnabled,
    setTimelineEnabled,
    timelineRange,
    setTimelineRange,
    activeFilterCount,
    reset: () => setFilters(DEFAULT_FILTERS),
  };
}
