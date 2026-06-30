export type ChatRoomType = "direct" | "group" | "report";

export interface ChatRoom {
  id: string;
  name: string | null;
  type: ChatRoomType;
  relatedReportId?: string | null;
  relatedSOSId?: string | null;
  createdAt: string;
}

export type MessageType = "text" | "system" | "ai_assistant" | "action" | "location" | "media";
export type MessageStatus = "sent" | "delivered" | "read";
export type MessagePriority = "normal" | "high" | "critical";

export interface ChatMessage {
  id: string;
  chatRoomId: string;
  senderId: string | null;
  content: string;
  messageType: MessageType;
  status: MessageStatus;
  isPinned: boolean;
  isPriority: boolean;
  priority?: MessagePriority;
  actions?: { id: string; label: string }[];
  createdAt: string;
}

export type QuickActionId =
  | "send_location"
  | "request_backup"
  | "mark_resolved"
  | "broadcast_alert";

export interface QuickAction {
  id: QuickActionId;
  label: string;
  icon: string;
  colorClass: string;
  bgClass: string;
}

export interface TypingState {
  userId: string;
  roomId: string;
}
