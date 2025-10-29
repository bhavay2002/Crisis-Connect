import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "../auth/replitAuth";

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

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication middleware
  await setupAuth(app);

  // Create HTTP server
  const httpServer = createServer(app);

  // WebSocket server setup for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // Helper function to broadcast messages to all connected clients
  function broadcastToAll(message: any) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // WebSocket connection handler
  wss.on("connection", (ws) => {
    console.log("New WebSocket client connected");

    ws.on("message", (message) => {
      console.log("Received message:", message.toString());
    });

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: "connected", message: "WebSocket connection established" }));
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

  return httpServer;
}
