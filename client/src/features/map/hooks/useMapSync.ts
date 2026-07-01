/**
 * useMapSync — keeps the command center map and incident panel in sync.
 * Single source of truth: commandCenterStore.
 */
export {
  useCommandCenter,
} from "@/store/commandCenterStore";

export type { CCIncident } from "@/store/commandCenterStore";

import { useCallback } from "react";
import { useCommandCenter } from "@/store/commandCenterStore";
import type { CCIncident } from "@/store/commandCenterStore";

/**
 * Returns a stable handler that converts a raw report object into a
 * CCIncident and writes it to the command center store.
 */
export function useSelectIncident() {
  const setSelected = useCommandCenter(s => s.setSelected);

  return useCallback((report: {
    id: string;
    latitude?: string | null;
    longitude?: string | null;
    title: string;
    type: string;
    severity: string;
    status: string;
    location: string;
    description: string;
    verificationCount: number;
    createdAt: string;
    aiValidationScore?: number | null;
    confirmedBy?: string | null;
  }) => {
    const lat = parseFloat(report.latitude ?? "");
    const lng = parseFloat(report.longitude ?? "");
    if (isNaN(lat) || isNaN(lng)) return;

    setSelected({
      id:                report.id,
      lat, lng,
      title:             report.title,
      type:              report.type,
      severity:          report.severity,
      status:            report.status,
      location:          report.location,
      description:       report.description,
      verificationCount: report.verificationCount,
      createdAt:         report.createdAt,
      aiValidationScore: report.aiValidationScore,
      confirmedBy:       report.confirmedBy,
    } as CCIncident);
  }, [setSelected]);
}
