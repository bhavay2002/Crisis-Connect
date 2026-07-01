/**
 * useCommandMode — adaptive UI hook.
 *
 * When critical incidents are live, the app shifts to a heightened visual
 * state: darker, more contrast, fewer distractions. This mirrors how real
 * emergency operations centers behave — the room gets quieter and more focused
 * when something critical is happening.
 *
 * Usage:
 *   const { isCommandMode, criticalCount } = useCommandMode();
 *   <div className={isCommandMode ? "bg-slate-950" : "bg-slate-900"}>
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DisasterReport } from "@shared/schema";

export interface CommandModeState {
  isCommandMode: boolean;
  criticalCount: number;
  activeCount:   number;
}

export function useCommandMode(): CommandModeState {
  const { data: reportsResponse } = useQuery<{ data: DisasterReport[]; pagination: any }>({
    queryKey: ["/api/reports"],
    staleTime: 30_000,
  });

  return useMemo(() => {
    const reports     = reportsResponse?.data || [];
    const active      = reports.filter(r => r.status !== "resolved");
    const criticalCount = active.filter(r => r.severity === "critical").length;

    return {
      isCommandMode: criticalCount >= 1,
      criticalCount,
      activeCount:   active.length,
    };
  }, [reportsResponse]);
}
