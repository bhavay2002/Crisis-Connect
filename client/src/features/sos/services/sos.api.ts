import { api } from "@/shared/services/api";
import type { SOSAlert, SOSActivationPayload } from "../types/sos.types";

/** Fetch all currently active SOS alerts */
export const fetchActiveAlerts = () =>
  api.get<SOSAlert[]>("/api/sos/active");

/** Fetch SOS alerts for the current user */
export const fetchMyAlerts = () =>
  api.get<SOSAlert[]>("/api/sos/my");

/** Activate a new SOS alert */
export const activateSOS = (payload: SOSActivationPayload) =>
  api.post<SOSAlert>("/api/sos", payload);

/** Resolve/cancel an active SOS alert */
export const resolveAlert = (id: string) =>
  api.patch<SOSAlert>(`/api/sos/${id}/resolve`);
