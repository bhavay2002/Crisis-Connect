/**
 * useCrisisRealtime — subscribes to WebSocket events and keeps the crisis
 * feature state fresh.
 *
 * Performance note: handler is stored in a ref by useRealtimeMessage, so
 * options callbacks changing does NOT cause re-subscription.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeMessage } from "@/providers/WebSocketProvider";
import { useDecisionStore } from "@/store/decisionStore";
import { useStableCallback } from "@/shared/hooks";

export interface UseCrisisRealtimeOptions {
  onNewReport?: (data: any) => void;
  onSOSAlert?:  (data: any) => void;
}

export function useCrisisRealtime(options: UseCrisisRealtimeOptions = {}) {
  const queryClient = useQueryClient();

  // Stable refs for callbacks — prevents re-subscription when options change
  const onNewReport = useStableCallback(options.onNewReport ?? (() => {}));
  const onSOSAlert  = useStableCallback(options.onSOSAlert  ?? (() => {}));

  const handler = useCallback(
    (msg: any) => {
      const ds = useDecisionStore.getState();

      switch (msg.type) {
        case "new_report":
          // WebSocketProvider handles invalidation; we just react
          if (msg.data?.id) {
            ds.markReportNew(msg.data.id);
            setTimeout(() => ds.unmarkReportNew(msg.data.id), 4000);
          }
          onNewReport(msg.data);
          break;

        case "report_updated":
        case "report_verified":
          // Already surgically patched by WebSocketProvider — nothing to do
          break;

        case "sos_alert":
        case "SOS_ACTIVATED":
          queryClient.invalidateQueries({ queryKey: ["/api/sos/active"] });
          onSOSAlert(msg.data);
          break;
      }
    },
    [queryClient, onNewReport, onSOSAlert]
  );

  useRealtimeMessage(handler);
}
