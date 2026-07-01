/**
 * useCrisisStats — derives dashboard statistics from the report list.
 * Pure computation — no API calls, no side effects.
 */
import { useMemo } from "react";
import type { CrisisReport, CrisisStats } from "../types/crisis.types";

export function useCrisisStats(reports: CrisisReport[]): CrisisStats {
  return useMemo(() => {
    const active = reports.filter(r => r.status !== "resolved");
    return {
      activeReports:     active.length,
      criticalCount:     active.filter(r => r.severity === "critical").length,
      verifiedIncidents: reports.filter(r => r.status === "verified" || r.status === "responding").length,
      responseTeams:     reports.filter(r => r.status === "responding").length,
      affectedAreas:     new Set(reports.map(r => r.location)).size,
      resolvedToday:     reports.filter(r => r.status === "resolved").length,
    };
  }, [reports]);
}

export function useSeverityBreakdown(reports: CrisisReport[]) {
  return useMemo(() => {
    const active = reports.filter(r => r.status !== "resolved");
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    active.forEach(r => { if (r.severity in counts) counts[r.severity as keyof typeof counts]++; });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return { counts, total };
  }, [reports]);
}
