import type { Severity } from "@/shared/types/common.types";

export type DisasterType =
  | "fire" | "flood" | "earthquake" | "storm" | "road_accident"
  | "epidemic" | "landslide" | "gas_leak" | "building_collapse"
  | "chemical_spill" | "power_outage" | "water_contamination" | "other";

export type ReportStatus = "pending" | "verified" | "responding" | "resolved";

export interface CrisisReport {
  id: string;
  title: string;
  type: DisasterType;
  severity: Severity;
  status: ReportStatus;
  location: string;
  description: string;
  latitude?: string | null;
  longitude?: string | null;
  verificationCount: number;
  createdAt: string;
  updatedAt: string;
  userId: string;
  aiValidationScore?: number | null;
  aiValidationNotes?: string | null;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  mediaUrls?: string[];
}

export interface RecommendedAction {
  label: string;
  url: string;
  type: "dispatch" | "broadcast" | "view" | "escalate";
  confidence: number;
}

export interface ActiveDecision {
  id: string;
  title: string;
  severity: Severity;
  location: string;
  createdAt: string;
  aiScore: number;
  recommendedActions: RecommendedAction[];
}

export interface CrisisEvent {
  id?: string;
  type: "new_report" | "report_updated" | "sos_alert" | "notification" | "system" | "broadcast";
  message: string;
  subtext?: string;
  severity?: Severity;
  timestamp: number;
  url?: string;
}

export interface CrisisStats {
  activeReports: number;
  criticalCount: number;
  verifiedIncidents: number;
  responseTeams: number;
  affectedAreas: number;
  resolvedToday: number;
}
