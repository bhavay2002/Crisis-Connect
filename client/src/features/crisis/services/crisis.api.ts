import { api } from "@/shared/services/api";
import type { CrisisReport, ActiveDecision } from "../types/crisis.types";
import type { PaginatedResponse } from "@/shared/types/common.types";

/** Fetch paginated crisis reports */
export const fetchReports = (params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return api.get<PaginatedResponse<CrisisReport>>(`/api/reports${qs}`);
};

/** Fetch a single report by ID */
export const fetchReport = (id: string) =>
  api.get<CrisisReport>(`/api/reports/${id}`);

/** Submit a community upvote for a report */
export const verifyReport = (id: string) =>
  api.post(`/api/reports/${id}/verify`);

/** Mark a report as resolved */
export const resolveReport = (id: string) =>
  api.patch(`/api/reports/${id}`, { status: "resolved" });

/** Submit a new crisis report */
export const submitReport = (payload: Partial<CrisisReport>) =>
  api.post<CrisisReport>("/api/reports", payload);

/** Fetch top AI-ranked decisions (Command Panel) */
export const fetchActiveDecisions = () =>
  api.get<ActiveDecision[]>("/api/decisions/active");

/** Fetch reports matching a search query */
export const searchReports = (query: string) =>
  api.get<PaginatedResponse<CrisisReport>>(`/api/reports?search=${encodeURIComponent(query)}`);
