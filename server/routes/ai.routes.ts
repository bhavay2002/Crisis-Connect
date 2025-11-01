import type { Express } from "express";
import { storage } from "../db/storage";
import { isAuthenticated } from "../auth/replitAuth";
import { AICrisisGuidanceService } from "../modules/ai/crisis-guidance.controller";
import { aiRequestLimiter } from "../middleware/rateLimiting";

// Placeholder for broadcast function - will be injected via index.ts
let broadcastToAll: (message: any) => void = () => {};

export function setBroadcastFunction(fn: (message: any) => void) {
  broadcastToAll = fn;
}

export function registerAIRoutes(app: Express) {
  // AI assistance in chat rooms
  app.post("/api/chat/rooms/:roomId/ai-assist", isAuthenticated, aiRequestLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { roomId } = req.params;
      const { question, emergencyType, severity, description, location } = req.body;

      // Check if user is a member of the chat room
      const isMember = await storage.isChatRoomMember(roomId, userId);
      if (!isMember) {
        return res.status(403).json({ 
          message: "You must be a member to use AI assistance in this chat room" 
        });
      }

      const aiService = new AICrisisGuidanceService();

      // If emergency context is provided, use crisis guidance
      if (emergencyType && severity && description && location) {
        const guidance = await aiService.getCrisisGuidance(
          emergencyType,
          severity,
          description,
          location
        );

        // Create AI assistant message
        const aiMessage = await storage.createMessage({
          chatRoomId: roomId,
          senderId: null,
          content: JSON.stringify(guidance),
          messageType: "ai_assistant",
          metadata: { 
            emergencyType, 
            severity, 
            description, 
            location 
          },
        });

        // Broadcast AI message to all connected WebSocket clients
        broadcastToAll({ type: "new_message", data: aiMessage });

        res.status(201).json({ message: aiMessage, guidance });
      } else if (question) {
        // Get recent messages for context
        const recentMessages = await storage.getMessages(roomId, 10);
        const conversationContext = recentMessages
          .map(m => `${m.senderId ? 'User' : 'AI'}: ${m.content}`)
          .join('\n');

        const response = await aiService.getChatGuidance(conversationContext, question);

        // Create AI assistant message
        const aiMessage = await storage.createMessage({
          chatRoomId: roomId,
          senderId: null,
          content: response,
          messageType: "ai_assistant",
          metadata: { question },
        });

        // Broadcast AI message to all connected WebSocket clients
        broadcastToAll({ type: "new_message", data: aiMessage });

        res.status(201).json({ message: aiMessage, response });
      } else {
        return res.status(400).json({ 
          message: "Either provide emergency context or a question for AI assistance" 
        });
      }
    } catch (error: any) {
      console.error("Error getting AI assistance:", error);
      res.status(500).json({ message: "Failed to get AI assistance" });
    }
  });
}
