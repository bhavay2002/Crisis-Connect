/**
 * useChatActions — mutation wrappers for all chat operations.
 * Components call these; they never call API functions directly.
 */
import { useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/shared/hooks";
import {
  sendMessage, pinMessage, executeAction, broadcastTyping,
} from "../services/chat.api";
import type { QuickActionId } from "../types/chat.types";

export function useChatActions(roomId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms", roomId, "messages"] });
  }, [queryClient, roomId]);

  const sendMutation = useMutation({
    mutationFn: ({ content, type = "text" }: { content: string; type?: string }) => {
      if (!roomId) throw new Error("No room selected");
      return sendMessage(roomId, content, type);
    },
    onSuccess: invalidate,
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  const pinMutation = useMutation({
    mutationFn: ({ messageId, isPinned }: { messageId: string; isPinned: boolean }) => {
      if (!roomId) throw new Error("No room selected");
      return pinMessage(roomId, messageId, isPinned);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms", roomId, "pinned"] });
      invalidate();
    },
  });

  const actionMutation = useMutation({
    mutationFn: (actionId: QuickActionId) => {
      if (!roomId) throw new Error("No room selected");
      return executeAction(roomId, actionId);
    },
    onSuccess: invalidate,
    onError: () => {
      toast({ title: "Action logged" });
      invalidate();
    },
  });

  const sendTyping = useCallback(
    (isTyping: boolean) => { if (roomId) broadcastTyping(roomId, isTyping); },
    [roomId]
  );

  const handleInputActivity = useCallback(() => {
    sendTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => sendTyping(false), 2000);
  }, [sendTyping]);

  const stopTyping = useCallback(() => {
    sendTyping(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  }, [sendTyping]);

  return {
    send:            (content: string) => sendMutation.mutate({ content }),
    pin:             (messageId: string, isPinned: boolean) => pinMutation.mutate({ messageId, isPinned }),
    executeAction:   (actionId: QuickActionId) => actionMutation.mutate(actionId),
    handleInputActivity,
    stopTyping,
    isSending:       sendMutation.isPending,
    isExecuting:     actionMutation.isPending,
  };
}
