import type { Express } from "express";
import { storage } from "../db/storage";
import { isAuthenticated } from "../auth/replitAuth";
import { 
  insertChatRoomSchema, 
  insertChatRoomMemberSchema,
  insertMessageSchema 
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { messageLimiter } from "../middleware/rateLimiting";

// Placeholder for broadcast function - will be injected via index.ts
let broadcastToAll: (message: any) => void = () => {};

export function setBroadcastFunction(fn: (message: any) => void) {
  broadcastToAll = fn;
}

export function registerChatRoutes(app: Express) {
  // Create chat room
  app.post("/api/chat/rooms", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertChatRoomSchema.parse({
        ...req.body,
        createdBy: userId,
      });

      const chatRoom = await storage.createChatRoom(validatedData);

      // Automatically add creator as a member
      await storage.addChatRoomMember({
        chatRoomId: chatRoom.id,
        userId,
        role: "admin",
      });

      res.status(201).json(chatRoom);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating chat room:", error);
      res.status(500).json({ message: "Failed to create chat room" });
    }
  });

  // Get user's chat rooms
  app.get("/api/chat/rooms", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const chatRooms = await storage.getUserChatRooms(userId);
      res.json(chatRooms);
    } catch (error) {
      console.error("Error fetching chat rooms:", error);
      res.status(500).json({ message: "Failed to fetch chat rooms" });
    }
  });

  // Get specific chat room
  app.get("/api/chat/rooms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      // Check if user is a member of the chat room
      const isMember = await storage.isChatRoomMember(id, userId);
      if (!isMember) {
        return res.status(403).json({ 
          message: "You must be a member to access this chat room" 
        });
      }

      const chatRoom = await storage.getChatRoom(id);
      if (!chatRoom) {
        return res.status(404).json({ message: "Chat room not found" });
      }

      res.json(chatRoom);
    } catch (error) {
      console.error("Error fetching chat room:", error);
      res.status(500).json({ message: "Failed to fetch chat room" });
    }
  });

  // Add member to chat room
  app.post("/api/chat/rooms/:id/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { userId: newMemberId, role } = req.body;

      if (!newMemberId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Check if chat room exists
      const chatRoom = await storage.getChatRoom(id);
      if (!chatRoom) {
        return res.status(404).json({ message: "Chat room not found" });
      }

      // Only creator or admin can add members
      if (chatRoom.createdBy !== userId) {
        const user = await storage.getUser(userId);
        if (!user || user.role !== "admin") {
          return res.status(403).json({ 
            message: "Only the creator or admin can add members" 
          });
        }
      }

      // Verify new member exists
      const newMember = await storage.getUser(newMemberId);
      if (!newMember) {
        return res.status(404).json({ message: "User to add not found" });
      }

      const validatedData = insertChatRoomMemberSchema.parse({
        chatRoomId: id,
        userId: newMemberId,
        role: role || "member",
      });

      const member = await storage.addChatRoomMember(validatedData);
      res.status(201).json(member);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error adding chat room member:", error);
      res.status(500).json({ message: "Failed to add chat room member" });
    }
  });

  // Remove member from chat room
  app.delete("/api/chat/rooms/:id/members/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const { id, userId: memberToRemove } = req.params;

      // Check if chat room exists
      const chatRoom = await storage.getChatRoom(id);
      if (!chatRoom) {
        return res.status(404).json({ message: "Chat room not found" });
      }

      // Only creator or admin can remove members (or users can remove themselves)
      if (chatRoom.createdBy !== currentUserId && memberToRemove !== currentUserId) {
        const user = await storage.getUser(currentUserId);
        if (!user || user.role !== "admin") {
          return res.status(403).json({ 
            message: "Only the creator, admin, or the member themselves can remove members" 
          });
        }
      }

      await storage.removeChatRoomMember(id, memberToRemove);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing chat room member:", error);
      res.status(500).json({ message: "Failed to remove chat room member" });
    }
  });

  // Send message to chat room
  app.post("/api/chat/rooms/:roomId/messages", isAuthenticated, messageLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { roomId } = req.params;

      // Check if user is a member of the chat room
      const isMember = await storage.isChatRoomMember(roomId, userId);
      if (!isMember) {
        return res.status(403).json({ 
          message: "You must be a member to send messages in this chat room" 
        });
      }

      const validatedData = insertMessageSchema.parse({
        ...req.body,
        chatRoomId: roomId,
        senderId: userId,
      });

      const message = await storage.createMessage(validatedData);

      // Update last read timestamp
      await storage.updateLastReadAt(roomId, userId);

      // Broadcast new message to all connected WebSocket clients
      broadcastToAll({ type: "new_message", data: message });

      res.status(201).json(message);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Get messages from chat room
  app.get("/api/chat/rooms/:roomId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { roomId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

      // Check if user is a member of the chat room
      const isMember = await storage.isChatRoomMember(roomId, userId);
      if (!isMember) {
        return res.status(403).json({ 
          message: "You must be a member to view messages in this chat room" 
        });
      }

      const messages = await storage.getMessages(roomId, limit);

      // Update last read timestamp
      await storage.updateLastReadAt(roomId, userId);

      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });
}
