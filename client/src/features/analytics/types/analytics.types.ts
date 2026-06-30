import type { Severity } from "@/shared/types/common.types";

export interface AnalyticsSummary {
  totalReports: number;
  resolvedReports: number;
  activeAlerts: number;
  averageResponseTime?: number;
}

export interface TrendPoint {
  date: string;
  count: number;
  severity?: Severity;
}

export interface RiskPrediction {
  region: string;
  riskScore: number;
  confidence: number;
  factors: string[];
  predictedAt: string;
}

export interface PlatformStats {
  totalReports: number;
  totalSOS: number;
  totalUsers: number;
  activeConnections: number;
}

export interface MonitoringStats {
  platform: PlatformStats;
  circuitBreakers: { name: string; state: string }[];
  uptime: number;
  environment: string;
}
