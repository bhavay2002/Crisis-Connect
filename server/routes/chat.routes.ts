import type { Express } from "express";
import { storage } from "../db/storage";
import { isAuthenticated } from "../middleware/jwtAuth";
import {
  insertChatRoomSchema,
  insertChatRoomMemberSchema,
  insertMessageSchema,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { messageLimiter } from "../middleware/rateLimiting";
import { logger } from "../utils/logger";

let broadcastToAll: (message: any) => void = () => {};

export function setBroadcastFunction(fn: (message: any) => void) {
  broadcastToAll = fn;
}

export function registerChatRoutes(app: Express) {
  app.post("/api/chat/rooms", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const validatedData = insertChatRoomSchema.parse({ ...req.body, createdBy: userId });
      const chatRoom = await storage.createChatRoom(validatedData);
      await storage.addChatRoomMember({ chatRoomId: chatRoom.id, userId, role: "admin" });
      res.status(201).json(chatRoom);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: fromZodError(error).message });
      logger.error("Error creating chat room", error);
      res.status(500).json({ message: "Failed to create chat room" });
    }
  });

  app.get("/api/chat/rooms", isAuthenticated, async (req: any, res) => {
    try {
      const chatRooms = await storage.getUserChatRooms(req.user.userId);
      res.json(chatRooms);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat rooms" });
    }
  });

  app.get("/api/chat/rooms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const isMember = await storage.isChatRoomMember(id, req.user.userId);
      if (!isMember) return res.status(403).json({ message: "Not a member of this chat room" });
      const chatRoom = await storage.getChatRoom(id);
      if (!chatRoom) return res.status(404).json({ message: "Chat room not found" });
      res.json(chatRoom);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat room" });
    }
  });

  app.post("/api/chat/rooms/:id/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { id } = req.params;
      const { userId: newMemberId, role } = req.body;
      if (!newMemberId) return res.status(400).json({ message: "User ID is required" });
      const chatRoom = await storage.getChatRoom(id);
      if (!chatRoom) return res.status(404).json({ message: "Chat room not found" });
      if (chatRoom.createdBy !== userId) {
        const user = await storage.getUser(userId);
        if (!user || user.role !== "admin") return res.status(403).json({ message: "Only creator or admin can add members" });
      }
      const newMember = await storage.getUser(newMemberId);
      if (!newMember) return res.status(404).json({ message: "User to add not found" });
      const member = await storage.addChatRoomMember(insertChatRoomMemberSchema.parse({ chatRoomId: id, userId: newMemberId, role: role || "member" }));
      res.status(201).json(member);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: fromZodError(error).message });
      res.status(500).json({ message: "Failed to add member" });
    }
  });

  app.delete("/api/chat/rooms/:id/members/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.userId;
      const { id, userId: memberToRemove } = req.params;
      const chatRoom = await storage.getChatRoom(id);
      if (!chatRoom) return res.status(404).json({ message: "Chat room not found" });
      if (chatRoom.createdBy !== currentUserId && memberToRemove !== currentUserId) {
        const user = await storage.getUser(currentUserId);
        if (!user || user.role !== "admin") return res.status(403).json({ message: "Permission denied" });
      }
      await storage.removeChatRoomMember(id, memberToRemove);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  app.post("/api/chat/rooms/:roomId/messages", isAuthenticated, messageLimiter, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { roomId } = req.params;
      const isMember = await storage.isChatRoomMember(roomId, userId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const validatedData = insertMessageSchema.parse({ ...req.body, chatRoomId: roomId, senderId: userId });
      const message = await storage.createMessage(validatedData);
      await storage.updateLastReadAt(roomId, userId);
      broadcastToAll({
        type: "chat_message",
        event: "RECEIVE_MESSAGE",
        data: { ...message, roomId },
      });
      res.status(201).json(message);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: fromZodError(error).message });
      logger.error("Error sending message", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/chat/rooms/:roomId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { roomId } = req.params;
      const isMember = await storage.isChatRoomMember(roomId, userId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const messages = await storage.getMessages(roomId, limit);
      await storage.updateLastReadAt(roomId, userId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get("/api/chat/rooms/:roomId/messages/pinned", isAuthenticated, async (req: any, res) => {
    try {
      const { roomId } = req.params;
      const isMember = await storage.isChatRoomMember(roomId, req.user.userId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const pinned = await storage.getPinnedMessages(roomId);
      res.json(pinned);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pinned messages" });
    }
  });

  app.patch("/api/chat/rooms/:roomId/messages/:messageId/read", isAuthenticated, async (req: any, res) => {
    try {
      const { roomId, messageId } = req.params;
      const isMember = await storage.isChatRoomMember(roomId, req.user.userId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const updated = await storage.updateMessageStatus(messageId, "read");
      broadcastToAll({
        type: "chat_message",
        event: "READ_RECEIPT",
        data: { messageId, roomId, readBy: req.user.userId, readAt: new Date().toISOString() },
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  app.patch("/api/chat/rooms/:roomId/messages/:messageId/deliver", isAuthenticated, async (req: any, res) => {
    try {
      const { roomId, messageId } = req.params;
      const isMember = await storage.isChatRoomMember(roomId, req.user.userId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const updated = await storage.updateMessageStatus(messageId, "delivered");
      broadcastToAll({
        type: "chat_message",
        event: "DELIVERY_RECEIPT",
        data: { messageId, roomId, deliveredTo: req.user.userId, deliveredAt: new Date().toISOString() },
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark as delivered" });
    }
  });

  app.patch("/api/chat/rooms/:roomId/messages/:messageId/pin", isAuthenticated, async (req: any, res) => {
    try {
      const { roomId, messageId } = req.params;
      const chatRoom = await storage.getChatRoom(roomId);
      if (!chatRoom) return res.status(404).json({ message: "Room not found" });
      const userId = req.user.userId;
      if (chatRoom.createdBy !== userId) {
        const user = await storage.getUser(userId);
        if (!user || user.role !== "admin") return res.status(403).json({ message: "Only room creator or admin can pin messages" });
      }
      const isPinned = req.body.isPinned !== false;
      const updated = await storage.pinMessage(messageId, isPinned);
      broadcastToAll({
        type: "chat_message",
        event: isPinned ? "MESSAGE_PINNED" : "MESSAGE_UNPINNED",
        data: { messageId, roomId, pinnedBy: userId },
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to pin message" });
    }
  });

  app.post("/api/chat/rooms/:roomId/typing", isAuthenticated, async (req: any, res) => {
    try {
      const { roomId } = req.params;
      const isMember = await storage.isChatRoomMember(roomId, req.user.userId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const isTyping = req.body.isTyping !== false;
      broadcastToAll({
        type: "chat_message",
        event: isTyping ? "TYPING_START" : "TYPING_STOP",
        data: { roomId, userId: req.user.userId, timestamp: new Date().toISOString() },
      });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to send typing indicator" });
    }
  });

  // Quick action endpoint — maps actionId to a system message + WS events
  app.post("/api/chat/rooms/:roomId/action", isAuthenticated, async (req: any, res) => {
    try {
      const { roomId } = req.params;
      const userId = req.user.userId;
      const { actionId, incidentId } = req.body as { actionId: string; incidentId?: string };

      const isMember = await storage.isChatRoomMember(roomId, userId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });

      const ACTION_LABELS: Record<string, string> = {
        send_location:   "📍 Location shared by responder",
        request_backup:  "🆘 Backup requested — nearest units notified",
        mark_resolved:   "✅ Incident marked as resolved by responder",
        broadcast_alert: "📢 Emergency broadcast triggered",
      };

      const label = ACTION_LABELS[actionId] || `Action executed: ${actionId}`;

      const systemMsg = await storage.createMessage({
        chatRoomId:  roomId,
        senderId:    null,
        content:     label,
        messageType: "system",
        status:      "delivered",
        isPinned:    false,
        isPriority:  false,
      });

      broadcastToAll({
        type:  "chat_message",
        event: "RECEIVE_MESSAGE",
        data:  { roomId, id: systemMsg.id, messageType: "system", content: label },
      });

      broadcastToAll({
        type:    "CHAT_ACTION_EXECUTED",
        actionId,
        incidentId,
        roomId,
        executedBy: userId,
        timestamp:  new Date().toISOString(),
      });

      logger.info("Chat action executed", { actionId, roomId, userId });
      res.json({ ok: true, systemMessage: systemMsg });
    } catch (error) {
      logger.error("Chat action error", error as Error);
      res.status(500).json({ message: "Failed to execute action" });
    }
  });

  app.post("/api/chat/dm", isAuthenticated, async (req: any, res) => {
    try {
      const { targetUserId, incidentId } = req.body;
      if (!targetUserId) return res.status(400).json({ message: "targetUserId is required" });
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) return res.status(404).json({ message: "Target user not found" });
      const room = await storage.findOrCreateDMRoom(req.user.userId, targetUserId, incidentId);
      res.json(room);
    } catch (error) {
      logger.error("Error creating DM room", error as Error);
      res.status(500).json({ message: "Failed to create direct message room" });
    }
  });

  app.get("/api/chat/rooms/:id/members", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const isMember = await storage.isChatRoomMember(id, req.user.userId);
      if (!isMember) return res.status(403).json({ message: "Not a member" });
      const members = await storage.getChatRoomMembers(id);
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });
}
