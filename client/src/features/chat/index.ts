// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  ChatRoom, ChatMessage, ChatRoomType, MessageType, MessageStatus,
  MessagePriority, QuickAction, QuickActionId, TypingState,
} from "./types/chat.types";

// ── Services ──────────────────────────────────────────────────────────────────
export {
  fetchRooms, fetchMessages, fetchPinnedMessages, sendMessage,
  markDelivered, pinMessage, broadcastTyping, executeAction,
  createRoom, findOrCreateDM,
} from "./services/chat.api";

// ── Store ─────────────────────────────────────────────────────────────────────
export { useChatStore } from "./store/chat.store";

// ── Hooks ─────────────────────────────────────────────────────────────────────
export { useChatSocket }  from "./hooks/useChatSocket";
export { useChatActions } from "./hooks/useChatActions";

// ── Components ────────────────────────────────────────────────────────────────
export { MessageBubble, SystemMessageBubble, PriorityMessageBubble } from "./components/MessageBubble";
export { PinnedBar }    from "./components/PinnedBar";
export { QuickActions } from "./components/QuickActions";
export { RoomList }     from "./components/RoomList";
