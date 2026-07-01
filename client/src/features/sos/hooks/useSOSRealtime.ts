/**
 * useSOSRealtime — subscribes to SOS-related WebSocket events.
 * Invalidates SOS queries so components always see fresh data.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeMessage } from "@/providers/WebSocketProvider";
import { useToast } from "@/shared/hooks";

export function useSOSRealtime() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handler = useCallback(
    (msg: any) => {
      if (msg.type === "sos_alert" || msg.type === "SOS_ACTIVATED") {
        queryClient.invalidateQueries({ queryKey: ["/api/sos/active"] });
        toast({
          title: "🚨 SOS Alert",
          description: msg.data?.location || "Emergency alert activated",
          variant: "destructive",
        });
      }
    },
    [queryClient, toast]
  );

  useRealtimeMessage(handler);
}
