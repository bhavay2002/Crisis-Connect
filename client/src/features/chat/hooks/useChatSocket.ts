/**
 * useChatSocket — handles all real-time chat WebSocket events.
 * Extracts this logic from the page component so ChatPage stays as a pure composer.
 */
import { useCallback, useRef } from "react";
import { useRealtimeMessage } from "@/providers/WebSocketProvider";
import { useChatStore } from "../store/chat.store";
import { markDelivered } from "../services/chat.api";

interface Options {
  selectedRoomId: string | null;
  currentUserId:  string | undefined;
  onNewMessage:   () => void;
}

export function useChatSocket({ selectedRoomId, currentUserId, onNewMessage }: Options) {
  const { setTyping } = useChatStore();
  const typingTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const handler = useCallback(
    (parsed: any) => {
      if (parsed.type !== "chat_message") return;

      if (parsed.event === "RECEIVE_MESSAGE" && parsed.data?.roomId === selectedRoomId) {
        onNewMessage();
        if (parsed.data.senderId !== currentUserId && selectedRoomId) {
          markDelivered(selectedRoomId, parsed.data.id);
        }
      }

      if (
        (parsed.event === "TYPING_START" || parsed.event === "TYPING_STOP") &&
        parsed.data?.roomId === selectedRoomId &&
        parsed.data?.userId !== currentUserId
      ) {
        const uid: string = parsed.data.userId;
        if (parsed.event === "TYPING_START") {
          setTyping(uid, true);
          if (typingTimers.current[uid]) clearTimeout(typingTimers.current[uid]);
          typingTimers.current[uid] = setTimeout(() => setTyping(uid, false), 3000);
        } else {
          setTyping(uid, false);
        }
      }

      if (parsed.event === "READ_RECEIPT" && parsed.data?.roomId === selectedRoomId) {
        onNewMessage();
      }
    },
    [selectedRoomId, currentUserId, onNewMessage, setTyping]
  );

  useRealtimeMessage(handler);
}
