/**
 * useAnalytics — provides pre-wired TanStack Query hooks for all analytics data.
 * Pages import these; they never call analytics API functions directly.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchSummary, fetchMonitoringStats, fetchPredictions } from "../services/analytics.api";

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ["/api/analytics/summary"],
    queryFn:  fetchSummary,
    staleTime: 60_000,
  });
}

export function useMonitoringStats() {
  return useQuery({
    queryKey: ["/api/monitoring/stats"],
    queryFn:  fetchMonitoringStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useRiskPredictions() {
  return useQuery({
    queryKey: ["/api/analytics/predictions"],
    queryFn:  fetchPredictions,
    staleTime: 120_000,
  });
}
