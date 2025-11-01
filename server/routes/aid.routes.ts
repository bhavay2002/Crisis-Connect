import type { Express } from "express";
import { storage } from "../db/storage";
import { isAuthenticated } from "../middleware/jwtAuth";
import { insertAidOfferSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { AIMatchingService } from "../modules/ai/matching.controller";

// Placeholder for broadcast function - will be injected via index.ts
let broadcastToAll: (message: any) => void = () => {};

export function setBroadcastFunction(fn: (message: any) => void) {
  broadcastToAll = fn;
}

export function registerAidRoutes(app: Express) {
  // Get all aid offers
  app.get("/api/aid-offers", async (req, res) => {
    try {
      const offers = await storage.getAllAidOffers();
      res.json(offers);
    } catch (error) {
      console.error("Error fetching aid offers:", error);
      res.status(500).json({ message: "Failed to fetch aid offers" });
    }
  });

  // Get specific aid offer
  app.get("/api/aid-offers/:id", async (req, res) => {
    try {
      const offer = await storage.getAidOffer(req.params.id);
      if (!offer) {
        return res.status(404).json({ message: "Aid offer not found" });
      }
      res.json(offer);
    } catch (error) {
      console.error("Error fetching aid offer:", error);
      res.status(500).json({ message: "Failed to fetch aid offer" });
    }
  });

  // Get user's aid offers
  app.get("/api/aid-offers/user/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const requestedUserId = req.params.userId;
      
      // Ensure users can only access their own offers
      if (userId !== requestedUserId) {
        return res.status(403).json({ message: "Forbidden: You can only access your own aid offers" });
      }
      
      const offers = await storage.getAidOffersByUser(requestedUserId);
      res.json(offers);
    } catch (error) {
      console.error("Error fetching user aid offers:", error);
      res.status(500).json({ message: "Failed to fetch user aid offers" });
    }
  });

  // Create new aid offer
  app.post("/api/aid-offers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const validatedData = insertAidOfferSchema.parse({
        ...req.body,
        userId,
      });

      const offer = await storage.createAidOffer(validatedData);
      
      // Broadcast new offer to all connected WebSocket clients
      broadcastToAll({ type: "new_aid_offer", data: offer });
      
      res.status(201).json(offer);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating aid offer:", error);
      res.status(500).json({ message: "Failed to create aid offer" });
    }
  });

  // Update aid offer status
  app.patch("/api/aid-offers/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!["available", "committed", "delivered"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const offer = await storage.updateAidOfferStatus(req.params.id, status);
      if (!offer) {
        return res.status(404).json({ message: "Aid offer not found" });
      }

      // Broadcast status update to all connected WebSocket clients
      broadcastToAll({ type: "aid_offer_updated", data: offer });

      res.json(offer);
    } catch (error) {
      console.error("Error updating aid offer status:", error);
      res.status(500).json({ message: "Failed to update aid offer status" });
    }
  });

  // Commit aid offer to a resource request
  app.post("/api/aid-offers/:offerId/commit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { offerId } = req.params;
      const { requestId } = req.body;

      if (!requestId) {
        return res.status(400).json({ message: "Request ID is required" });
      }

      // Check if offer exists and user owns it
      const offer = await storage.getAidOffer(offerId);
      if (!offer) {
        return res.status(404).json({ message: "Aid offer not found" });
      }

      if (offer.userId !== userId) {
        return res.status(403).json({ message: "You can only commit your own aid offers" });
      }

      // Check if request exists
      const request = await storage.getResourceRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Resource request not found" });
      }

      // Match the offer to the request
      const matchedOffer = await storage.matchAidOfferToRequest(offerId, requestId);
      
      // Update request status to in_progress
      await storage.updateResourceRequestStatus(requestId, "in_progress");

      // Broadcast commitment to all connected WebSocket clients
      broadcastToAll({ type: "aid_offer_committed", data: { offer: matchedOffer, requestId } });

      res.json(matchedOffer);
    } catch (error) {
      console.error("Error committing aid offer:", error);
      res.status(500).json({ message: "Failed to commit aid offer" });
    }
  });

  // Mark aid offer as delivered
  app.post("/api/aid-offers/:offerId/deliver", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { offerId } = req.params;

      // Check if offer exists and user owns it
      const offer = await storage.getAidOffer(offerId);
      if (!offer) {
        return res.status(404).json({ message: "Aid offer not found" });
      }

      if (offer.userId !== userId) {
        return res.status(403).json({ message: "You can only mark your own aid offers as delivered" });
      }

      // Mark as delivered
      const deliveredOffer = await storage.markAidOfferDelivered(offerId);
      
      // If matched to a request, mark that as fulfilled
      if (offer.matchedRequestId) {
        await storage.fulfillResourceRequest(offer.matchedRequestId, userId);
      }

      // Broadcast delivery to all connected WebSocket clients
      broadcastToAll({ type: "aid_offer_delivered", data: deliveredOffer });

      res.json(deliveredOffer);
    } catch (error) {
      console.error("Error marking aid offer as delivered:", error);
      res.status(500).json({ message: "Failed to mark aid offer as delivered" });
    }
  });

  // Get AI-powered matches for an aid offer
  app.get("/api/aid-offers/:offerId/matches", isAuthenticated, async (req, res) => {
    try {
      const { offerId} = req.params;
      const offer = await storage.getAidOffer(offerId);
      
      if (!offer) {
        return res.status(404).json({ message: "Aid offer not found" });
      }

      // Get pending resource requests
      const allRequests = await storage.getAllResourceRequests();
      const pendingRequests = allRequests.filter(r => r.status === "pending");
      
      // Use AI matching service to find best matches
      const matchingService = new AIMatchingService();
      const matches = await matchingService.findMatchesForOffer(offer, pendingRequests);
      
      res.json(matches);
    } catch (error) {
      console.error("Error finding matches for aid offer:", error);
      res.status(500).json({ message: "Failed to find matches" });
    }
  });

  // Run automated batch matching for all available offers and pending requests
  app.post("/api/matching/run-batch", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);

      // Only NGOs, admins, and volunteers can run batch matching
      if (!user || !["volunteer", "ngo", "admin"].includes(user.role as string)) {
        return res.status(403).json({ 
          message: "Only volunteers, NGOs, and admins can run batch matching" 
        });
      }

      // Get all available offers and pending requests
      const allOffers = await storage.getAllAidOffers();
      const availableOffers = allOffers.filter(o => o.status === "available");
      
      const allRequests = await storage.getAllResourceRequests();
      const pendingRequests = allRequests.filter(r => r.status === "pending");

      if (availableOffers.length === 0 || pendingRequests.length === 0) {
        return res.json({
          message: "No available offers or pending requests to match",
          totalMatches: 0,
          matches: [],
        });
      }

      // Run matching for all requests
      const matchingService = new AIMatchingService();
      const allMatches = [];
      
      // Track consumed offers to prevent double-matching in the same batch
      const consumedOfferIds = new Set<string>();
      let stillAvailableOffers = [...availableOffers];

      for (const request of pendingRequests) {
        // Only consider offers that haven't been consumed in this batch
        const matches = await matchingService.findMatchesForRequest(request, stillAvailableOffers);
        
        if (matches.length > 0) {
          // Get the best match (first in sorted list)
          const bestMatch = matches[0];
          
          // Mark this offer as consumed for this batch
          consumedOfferIds.add(bestMatch.offerId);
          stillAvailableOffers = stillAvailableOffers.filter(o => o.id !== bestMatch.offerId);
          
          // Persist match suggestion to database
          await storage.createMatchSuggestion({
            requestId: request.id,
            offerId: bestMatch.offerId,
            score: bestMatch.score,
            reasoning: bestMatch.reasoning,
            status: "pending",
          });

          allMatches.push({
            requestId: request.id,
            requestType: request.resourceType,
            requestQuantity: request.quantity,
            urgency: request.urgency,
            matches: matches,
          });
        }
      }

      // Broadcast matches found to all connected clients
      if (allMatches.length > 0) {
        broadcastToAll({ 
          type: "batch_matching_complete", 
          data: {
            totalMatches: allMatches.length,
            timestamp: new Date().toISOString(),
          }
        });
      }

      res.json({
        message: "Batch matching completed successfully",
        totalRequests: pendingRequests.length,
        totalOffers: availableOffers.length,
        matchedRequests: allMatches.length,
        matches: allMatches,
      });
    } catch (error) {
      console.error("Error running batch matching:", error);
      res.status(500).json({ message: "Failed to run batch matching" });
    }
  });

  // Get matching engine analytics
  app.get("/api/matching/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);

      // Only NGOs, admins, and volunteers can view analytics
      if (!user || !["volunteer", "ngo", "admin"].includes(user.role as string)) {
        return res.status(403).json({ 
          message: "Only volunteers, NGOs, and admins can view matching analytics" 
        });
      }

      const allOffers = await storage.getAllAidOffers();
      const allRequests = await storage.getAllResourceRequests();

      // Calculate analytics
      const analytics = {
        supply: {
          total: allOffers.length,
          available: allOffers.filter(o => o.status === "available").length,
          committed: allOffers.filter(o => o.status === "committed").length,
          delivered: allOffers.filter(o => o.status === "delivered").length,
          byType: {} as Record<string, number>,
        },
        demand: {
          total: allRequests.length,
          pending: allRequests.filter(r => r.status === "pending").length,
          inProgress: allRequests.filter(r => r.status === "in_progress").length,
          fulfilled: allRequests.filter(r => r.status === "fulfilled").length,
          byType: {} as Record<string, number>,
          byUrgency: {} as Record<string, number>,
        },
        gaps: [] as Array<{ resourceType: string; supply: number; demand: number; gap: number }>,
        matchRate: 0,
      };

      // Calculate supply by type
      allOffers.forEach(offer => {
        analytics.supply.byType[offer.resourceType] = 
          (analytics.supply.byType[offer.resourceType] || 0) + offer.quantity;
      });

      // Calculate demand by type and urgency
      allRequests.forEach(request => {
        if (request.status === "pending") {
          analytics.demand.byType[request.resourceType] = 
            (analytics.demand.byType[request.resourceType] || 0) + request.quantity;
          analytics.demand.byUrgency[request.urgency] = 
            (analytics.demand.byUrgency[request.urgency] || 0) + 1;
        }
      });

      // Calculate gaps (demand > supply)
      const resourceTypes = new Set([...Object.keys(analytics.supply.byType), ...Object.keys(analytics.demand.byType)]);
      resourceTypes.forEach(type => {
        const supply = analytics.supply.byType[type] || 0;
        const demand = analytics.demand.byType[type] || 0;
        const gap = demand - supply;
        if (gap > 0) {
          analytics.gaps.push({ resourceType: type, supply, demand, gap });
        }
      });

      // Calculate match rate
      if (allRequests.length > 0) {
        analytics.matchRate = Math.round(
          ((allRequests.filter(r => r.status !== "pending").length) / allRequests.length) * 100
        );
      }

      res.json(analytics);
    } catch (error) {
      console.error("Error fetching matching analytics:", error);
      res.status(500).json({ message: "Failed to fetch matching analytics" });
    }
  });
}
