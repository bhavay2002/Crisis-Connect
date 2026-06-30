import { api } from "@/shared/services/api";
import type { ChatRoom, ChatMessage, QuickActionId } from "../types/chat.types";

const AUTH = () => ({
  Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
});

/** List all rooms the current user is a member of */
export const fetchRooms = () =>
  api.get<ChatRoom[]>("/api/chat/rooms");

/** Fetch message history for a room */
export const fetchMessages = async (roomId: string): Promise<ChatMessage[]> => {
  const res = await fetch(`/api/chat/rooms/${roomId}/messages`, { headers: AUTH() });
  return res.json();
};

/** Fetch pinned messages for a room */
export const fetchPinnedMessages = async (roomId: string): Promise<ChatMessage[]> => {
  const res = await fetch(`/api/chat/rooms/${roomId}/messages/pinned`, { headers: AUTH() });
  return res.json();
};

/** Send a text message */
export const sendMessage = (roomId: string, content: string, messageType = "text") =>
  api.post<ChatMessage>(`/api/chat/rooms/${roomId}/messages`, { content, messageType });

/** Mark a message as delivered */
export const markDelivered = (roomId: string, messageId: string) =>
  fetch(`/api/chat/rooms/${roomId}/messages/${messageId}/deliver`, {
    method: "PATCH",
    headers: AUTH(),
  });

/** Toggle a message's pin state */
export const pinMessage = (roomId: string, messageId: string, isPinned: boolean) =>
  api.patch(`/api/chat/rooms/${roomId}/messages/${messageId}/pin`, { isPinned });

/** Broadcast typing status */
export const broadcastTyping = (roomId: string, isTyping: boolean) =>
  fetch(`/api/chat/rooms/${roomId}/typing`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH() },
    body: JSON.stringify({ isTyping }),
  }).catch(() => {});

/** Execute a quick action — creates a system message and emits WS events */
export const executeAction = (roomId: string, actionId: QuickActionId, incidentId?: string) =>
  api.post(`/api/chat/rooms/${roomId}/action`, { actionId, incidentId });

/** Create a new group channel */
export const createRoom = (name: string, type: "group" | "direct" = "group") =>
  api.post<ChatRoom>("/api/chat/rooms", { name, type });

/** Find or create a DM room between two users */
export const findOrCreateDM = (targetUserId: string, incidentId?: string) =>
  api.post<ChatRoom>("/api/chat/dm", { targetUserId, incidentId });
