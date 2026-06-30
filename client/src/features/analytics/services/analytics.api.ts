import { api } from "@/shared/services/api";
import type { AnalyticsSummary, TrendPoint, RiskPrediction, MonitoringStats } from "../types/analytics.types";

/** Fetch dashboard-level analytics summary */
export const fetchSummary = () =>
  api.get<AnalyticsSummary>("/api/analytics/summary");

/** Fetch time-series trend data */
export const fetchTrends = (params?: { days?: number; severity?: string }) => {
  const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
  return api.get<TrendPoint[]>(`/api/analytics/trends${qs}`);
};

/** Fetch AI-driven risk predictions */
export const fetchPredictions = () =>
  api.get<RiskPrediction[]>("/api/analytics/predictions");

/** Fetch platform monitoring stats */
export const fetchMonitoringStats = () =>
  api.get<MonitoringStats>("/api/monitoring/stats");

/** Export analytics data as CSV */
export const exportCSV = (type: "reports" | "users" | "analytics") =>
  api.get<Blob>(`/api/export/${type}`);
