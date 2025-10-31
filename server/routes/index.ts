import type { Express } from "express";
import { createServer, type Server, ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { Socket } from "net";
import { setupAuth } from "../auth/replitAuth";
import { logger } from "../utils/logger";
import type { IncomingMessage } from "http";

// Import route registration functions
import { registerAuthRoutes } from "./auth.routes";
import { 
  registerReportRoutes, 
  setBroadcastFunction as setReportBroadcast 
} from "./reports.routes";
import { 
  registerResourceRoutes,
  setBroadcastFunction as setResourceBroadcast 
} from "./resources.routes";
import { 
  registerAidRoutes,
  setBroadcastFunction as setAidBroadcast 
} from "./aid.routes";
import { registerInventoryRoutes } from "./inventory.routes";
import { registerAnalyticsRoutes } from "./analytics.routes";
import { 
  registerSOSRoutes,
  setBroadcastFunction as setSOSBroadcast 
} from "./sos.routes";
import { 
  registerChatRoutes,
  setBroadcastFunction as setChatBroadcast 
} from "./chat.routes";
import { 
  registerAIRoutes,
  setBroadcastFunction as setAIBroadcast 
} from "./ai.routes";
import { registerStorageRoutes } from "./storage.routes";
import { registerClusteringRoutes } from "./clustering.routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication middleware
  const sessionParser = await setupAuth(app);

  // Create HTTP server
  const httpServer = createServer(app);

  // WebSocket server setup for real-time updates (no server option)
  const wss = new WebSocketServer({ noServer: true });

  // Helper function to broadcast messages to all connected clients
  function broadcastToAll(message: any) {
    try {
      const messageStr = JSON.stringify(message);
      
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });
    } catch (error) {
      logger.error("Failed to broadcast message", error as Error, { 
        messageType: message.type,
      });
    }
  }

  // WebSocket connection handler
  wss.on("connection", (ws, req: IncomingMessage) => {
    const session = (req as any).session;
    const userId = session?.passport?.user?.claims?.sub;

    logger.info("WebSocket client connected", { 
      userId,
      ip: req.socket.remoteAddress,
    });

    ws.on("message", (rawMessage) => {
      try {
        const data = JSON.parse(rawMessage.toString());
        
        logger.debug("WebSocket message received", { 
          userId,
          messageType: data.type,
        });
      } catch (error) {
        logger.warn("Invalid WebSocket message format", { 
          userId,
          error: (error as Error).message,
        });
      }
    });

    ws.on("close", () => {
      logger.info("WebSocket client disconnected", { userId });
    });

    ws.on("error", (error) => {
      logger.error("WebSocket error", error, { userId });
    });

    // Send initial connection confirmation
    try {
      const connectionMsg = { 
        type: "connected", 
        message: "Secure WebSocket connection established (TLS encrypted)",
        userId,
      };
      ws.send(JSON.stringify(connectionMsg));
    } catch (error) {
      logger.error("Failed to send connection confirmation", error as Error, { userId });
    }
  });

  // Handle WebSocket upgrades with session authentication
  httpServer.on("upgrade", (req, socket: Socket, head) => {
    if (req.url !== "/ws") {
      socket.destroy();
      return;
    }

    // Create a proper ServerResponse object for session middleware
    const res = new ServerResponse(req);
    res.assignSocket(socket as any);

    // Parse session with proper request/response objects
    sessionParser(req as any, res as any, () => {
      const session = (req as any).session;

      // Reject unauthenticated connections
      if (!session || !session.passport || !session.passport.user) {
        logger.warn("WebSocket upgrade rejected - no valid session", {
          ip: socket.remoteAddress,
        });
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return; // Critical: stop processing
      }

      logger.info("WebSocket upgrade authenticated", {
        userId: session.passport.user.claims?.sub,
        ip: socket.remoteAddress,
      });

      // Detach socket from ServerResponse before upgrading
      res.detachSocket(socket);

      // Hand off to WebSocket server
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    });
  });

  // Inject broadcast function into route modules
  setReportBroadcast(broadcastToAll);
  setResourceBroadcast(broadcastToAll);
  setAidBroadcast(broadcastToAll);
  setSOSBroadcast(broadcastToAll);
  setChatBroadcast(broadcastToAll);
  setAIBroadcast(broadcastToAll);

  // Register all routes
  registerAuthRoutes(app);
  registerReportRoutes(app);
  registerResourceRoutes(app);
  registerAidRoutes(app);
  registerInventoryRoutes(app);
  registerAnalyticsRoutes(app);
  registerSOSRoutes(app);
  registerChatRoutes(app);
  registerAIRoutes(app);
  registerStorageRoutes(app);
  registerClusteringRoutes(app);

  return httpServer;
}
