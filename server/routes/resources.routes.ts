import type { Express } from "express";
import { storage } from "../db/storage";
import { isAuthenticated } from "../auth/replitAuth";
import { insertResourceRequestSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { AIMatchingService } from "../controllers/aiMatching";
import { resourceRequestLimiter } from "../middleware/rateLimiting";
import { AuditLogger } from "../middleware/auditLog";

// Placeholder for broadcast function - will be injected via index.ts
let broadcastToAll: (message: any) => void = () => {};

export function setBroadcastFunction(fn: (message: any) => void) {
  broadcastToAll = fn;
}

export function registerResourceRoutes(app: Express) {
  // Get all resource requests
  app.get("/api/resource-requests", async (req, res) => {
    try {
      const requests = await storage.getAllResourceRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching resource requests:", error);
      res.status(500).json({ message: "Failed to fetch resource requests" });
    }
  });

  // Get specific resource request
  app.get("/api/resource-requests/:id", async (req, res) => {
    try {
      const request = await storage.getResourceRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Resource request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error fetching resource request:", error);
      res.status(500).json({ message: "Failed to fetch resource request" });
    }
  });

  // Get user's resource requests
  app.get("/api/resource-requests/user/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Ensure users can only access their own requests
      if (userId !== requestedUserId) {
        return res.status(403).json({ message: "Forbidden: You can only access your own resource requests" });
      }
      
      const requests = await storage.getResourceRequestsByUser(requestedUserId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching user resource requests:", error);
      res.status(500).json({ message: "Failed to fetch user resource requests" });
    }
  });

  // Create new resource request
  app.post("/api/resource-requests", isAuthenticated, resourceRequestLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertResourceRequestSchema.parse({
        ...req.body,
        userId,
      });

      const request = await storage.createResourceRequest(validatedData);
      
      // Broadcast new request to all connected WebSocket clients
      broadcastToAll({ type: "new_resource_request", data: request });
      
      res.status(201).json(request);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating resource request:", error);
      res.status(500).json({ message: "Failed to create resource request" });
    }
  });

  // Update resource request status
  app.patch("/api/resource-requests/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!["pending", "in_progress", "fulfilled", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const request = await storage.updateResourceRequestStatus(req.params.id, status);
      if (!request) {
        return res.status(404).json({ message: "Resource request not found" });
      }

      // Broadcast status update to all connected WebSocket clients
      broadcastToAll({ type: "resource_request_updated", data: request });

      res.json(request);
    } catch (error) {
      console.error("Error updating resource request status:", error);
      res.status(500).json({ message: "Failed to update resource request status" });
    }
  });

  // Fulfill a resource request
  app.post("/api/resource-requests/:id/fulfill", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      // Check if request exists
      const request = await storage.getResourceRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Resource request not found" });
      }

      // Fulfill the request
      const fulfilledRequest = await storage.fulfillResourceRequest(id, userId);

      // Log fulfillment
      await AuditLogger.logResourceFulfillment(userId, id, req);

      // Broadcast fulfillment to all connected WebSocket clients
      if (fulfilledRequest) {
        broadcastToAll({ type: "resource_request_fulfilled", data: fulfilledRequest });
      }

      res.json(fulfilledRequest);
    } catch (error) {
      console.error("Error fulfilling resource request:", error);
      res.status(500).json({ message: "Failed to fulfill resource request" });
    }
  });

  // Get AI-powered matches for a resource request
  app.get("/api/resource-requests/:requestId/matches", isAuthenticated, async (req, res) => {
    try {
      const { requestId } = req.params;
      const request = await storage.getResourceRequest(requestId);
      
      if (!request) {
        return res.status(404).json({ message: "Resource request not found" });
      }

      // Get available aid offers
      const allOffers = await storage.getAllAidOffers();
      const availableOffers = allOffers.filter(o => o.status === "available");
      
      // Use AI matching service to find best matches
      const matchingService = new AIMatchingService();
      const matches = await matchingService.findMatchesForRequest(request, availableOffers);
      
      res.json(matches);
    } catch (error) {
      console.error("Error finding matches for resource request:", error);
      res.status(500).json({ message: "Failed to find matches" });
    }
  });
}
