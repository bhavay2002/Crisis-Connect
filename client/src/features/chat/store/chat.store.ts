import { create } from "zustand";
import type { ChatMessage } from "../types/chat.types";

interface ChatState {
  /** Optimistic messages appended before server confirmation */
  optimisticMessages: ChatMessage[];
  /** Users currently typing (by userId) in the selected room */
  typingUserIds: string[];
  addOptimistic:    (m: ChatMessage) => void;
  clearOptimistic:  () => void;
  setTyping:        (userId: string, isTyping: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  optimisticMessages: [],
  typingUserIds: [],

  addOptimistic: (m) =>
    set((s) => ({ optimisticMessages: [...s.optimisticMessages, m] })),

  clearOptimistic: () => set({ optimisticMessages: [] }),

  setTyping: (userId, isTyping) =>
    set((s) => ({
      typingUserIds: isTyping
        ? s.typingUserIds.includes(userId) ? s.typingUserIds : [...s.typingUserIds, userId]
        : s.typingUserIds.filter(id => id !== userId),
    })),
}));
