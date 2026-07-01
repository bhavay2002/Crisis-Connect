import type { Severity, LatLng } from "@/shared/types/common.types";

export type SOSStatus = "active" | "responding" | "resolved";

export interface SOSAlert {
  id: string;
  userId: string;
  status: SOSStatus;
  severity: Severity;
  location: string;
  latitude?: string | null;
  longitude?: string | null;
  description?: string;
  emergencyType?: string;
  contactNumber?: string;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface SOSActivationPayload {
  emergencyType: string;
  severity: Severity;
  location: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  contactNumber?: string;
}
