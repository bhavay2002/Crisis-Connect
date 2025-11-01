import type { Express } from "express";
import { createServer, type Server, ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { Socket } from "net";
import { logger } from "../utils/logger";
import type { IncomingMessage } from "http";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "../config/swagger";
import { verifyAccessToken } from "../utils/jwtUtils";

// Import route registration functions
import { registerAuthRoutes } from "./auth.routes";
import { registerNewAuthRoutes } from "./newAuth.routes";
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
import { tasksRouter } from "./tasks.routes";
import { registerCacheRoutes } from "./cache.routes";
import { registerExportRoutes } from "./export.routes";
import { wsRateLimiter } from "../middleware/wsRateLimiting";
import { config } from "../config";
import { encryptWebSocketMessage, shouldEncryptMessage, type SecureWebSocketMessage } from "../shared/websocket/ws-encryption";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);

  // WebSocket server setup for real-time updates (no server option)
  const wss = new WebSocketServer({ noServer: true });

  // Helper function to broadcast messages to all connected clients
  async function broadcastToAll(message: any) {
    try {
      let messageToSend: SecureWebSocketMessage = message;
      
      // Apply message-level encryption for sensitive types in non-TLS environments
      // or when explicitly enabled for defense-in-depth
      if (shouldEncryptMessage(message.type)) {
        messageToSend = await encryptWebSocketMessage(message);
        logger.debug("Broadcasting encrypted message", {
          type: message.type,
          encrypted: true,
        });
      }
      
      const messageStr = JSON.stringify(messageToSend);
      
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
    const userId = (req as any).userId;

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
      // Properly detect TLS: check X-Forwarded-Proto value (case-insensitive) OR socket encryption
      const forwardedProto = (req.headers['x-forwarded-proto'] as string)?.toLowerCase();
      const isTLS = forwardedProto === 'https' || !!(req.connection as any).encrypted;
      
      const connectionMsg = { 
        type: "connected", 
        message: isTLS 
          ? "Secure WebSocket connection established (TLS encrypted)" 
          : `WebSocket connection established${config.isDevelopment ? " (development mode - no TLS)" : ""}`,
        userId,
        secure: isTLS,
      };
      ws.send(JSON.stringify(connectionMsg));
      
      logger.info("WebSocket connection confirmed", {
        userId,
        secure: isTLS,
        protocol: forwardedProto || 'direct',
      });
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

    // Rate limiting based on IP address
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                     socket.remoteAddress || 
                     'unknown';
    
    if (!wsRateLimiter.isAllowed(clientIp)) {
      logger.warn("WebSocket upgrade rejected - rate limit exceeded", {
        ip: clientIp,
      });
      socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
      socket.destroy();
      return;
    }

    // Origin validation for CSRF protection
    const origin = req.headers.origin;
    const host = req.headers.host;
    
    if (origin) {
      const allowedOrigins = [
        `http://${host}`,
        `https://${host}`,
        `http://localhost:5000`,
        `https://localhost:5000`,
      ];
      
      try {
        const originUrl = new URL(origin);
        const isAllowed = allowedOrigins.some(allowed => {
          try {
            const allowedUrl = new URL(allowed);
            return originUrl.protocol === allowedUrl.protocol && 
                   originUrl.host === allowedUrl.host;
          } catch {
            return false;
          }
        });

        if (!isAllowed) {
          logger.warn("WebSocket upgrade rejected - invalid origin", {
            origin,
            host,
            ip: socket.remoteAddress,
          });
          socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
          socket.destroy();
          return;
        }
      } catch (error) {
        logger.warn("WebSocket upgrade rejected - malformed origin", {
          origin,
          error: error instanceof Error ? error.message : 'Unknown',
        });
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    // Extract and verify JWT token from query parameters or headers
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token') || req.headers['sec-websocket-protocol'];

    if (!token) {
      logger.warn("WebSocket upgrade rejected - no token", {
        ip: socket.remoteAddress,
        origin,
      });
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      (req as any).userId = payload.userId;

      logger.info("WebSocket upgrade authenticated", {
        userId: payload.userId,
        ip: socket.remoteAddress,
        origin,
      });

      // Hand off to WebSocket server
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } catch (error) {
      logger.warn("WebSocket upgrade rejected - invalid token", {
        ip: socket.remoteAddress,
        origin,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
  });

  // Inject broadcast function into route modules
  setReportBroadcast(broadcastToAll);
  setResourceBroadcast(broadcastToAll);
  setAidBroadcast(broadcastToAll);
  setSOSBroadcast(broadcastToAll);
  setChatBroadcast(broadcastToAll);
  setAIBroadcast(broadcastToAll);

  // API Version Information Endpoint
  app.get("/api", (req, res) => {
    res.json({
      name: "Crisis Connect API",
      version: "1.0.0",
      apiVersions: {
        v1: {
          status: "active",
          basePath: "/api/v1",
          documentation: "/api/v1/docs",
        },
      },
      documentation: "/api/v1/docs",
      healthCheck: "/api/health",
    });
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.isDevelopment ? "development" : "production",
    });
  });

  // Swagger Documentation - Serve at /api/v1/docs
  app.use(
    "/api/v1/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Crisis Connect API Documentation",
    })
  );

  // Serve OpenAPI spec as JSON
  app.get("/api/v1/openapi.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  // Register all routes (all routes already use /api prefix)
  // For v1 API, routes are registered as-is since they already include /api
  // To add versioning, we'll update individual route files to use /api/v1
  registerNewAuthRoutes(app);
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
  registerCacheRoutes(app);
  registerExportRoutes(app);
  
  // Register tasks routes
  app.use("/api/tasks", tasksRouter);

  return httpServer;
}
