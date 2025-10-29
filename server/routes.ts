import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertDisasterReportSchema, insertVerificationSchema, insertResourceRequestSchema, insertAidOfferSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { AIValidationService } from "./aiValidation";
import { AIMatchingService } from "./aiMatching";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication middleware
  await setupAuth(app);

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/admin/assignable-users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin and NGO users can access assignable users list
      if (!user.role || !["ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only NGOs and admins can access assignable users" 
        });
      }

      const users = await storage.getAssignableUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching assignable users:", error);
      res.status(500).json({ message: "Failed to fetch assignable users" });
    }
  });

  app.post("/api/auth/update-role", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { role } = req.body;
      
      // Validate role
      const validRoles = ["citizen", "volunteer", "ngo", "admin"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      // Get current user
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Security: Only admins can assign admin role
      // Also, admins cannot demote themselves to prevent lockout
      if (role === "admin") {
        if (currentUser.role !== "admin") {
          return res.status(403).json({ 
            message: "Forbidden: Only admins can assign admin role" 
          });
        }
      }
      
      // Prevent admins from accidentally demoting themselves
      if (currentUser.role === "admin" && role !== "admin") {
        return res.status(403).json({ 
          message: "Forbidden: Admins cannot demote themselves. Contact another admin." 
        });
      }
      
      const user = await storage.updateUserRole(userId, role);
      res.json(user);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // Get current user's verifications
  app.get("/api/verifications/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const verifications = await storage.getUserVerifications(userId);
      res.json(verifications);
    } catch (error) {
      console.error("Error fetching verifications:", error);
      res.status(500).json({ message: "Failed to fetch verifications" });
    }
  });

  // Disaster report routes
  app.get("/api/reports", async (req, res) => {
    try {
      const reports = await storage.getAllDisasterReports();
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.get("/api/reports/:id", async (req, res) => {
    try {
      const report = await storage.getDisasterReport(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      res.json(report);
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  app.get("/api/reports/user/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requestedUserId = req.params.userId;
      
      // Ensure users can only access their own reports
      if (userId !== requestedUserId) {
        return res.status(403).json({ message: "Forbidden: You can only access your own reports" });
      }
      
      const reports = await storage.getDisasterReportsByUser(requestedUserId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching user reports:", error);
      res.status(500).json({ message: "Failed to fetch user reports" });
    }
  });

  app.post("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertDisasterReportSchema.parse({
        ...req.body,
        userId,
      });

      // Run AI validation
      const aiService = new AIValidationService();
      const existingReports = await storage.getAllDisasterReports();
      const aiValidation = await aiService.validateReport(
        {
          title: validatedData.title,
          description: validatedData.description,
          type: validatedData.type,
          severity: validatedData.severity,
          location: validatedData.location,
          latitude: validatedData.latitude,
          longitude: validatedData.longitude,
        },
        existingReports
      );

      // Add AI validation results to the report
      const reportWithAI = {
        ...validatedData,
        aiValidationScore: aiValidation.score,
        aiValidationNotes: aiValidation.notes,
      };

      const report = await storage.createDisasterReport(reportWithAI);
      
      // Broadcast new report to all connected WebSocket clients
      broadcastToAll({ type: "new_report", data: report });
      
      res.status(201).json(report);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating report:", error);
      res.status(500).json({ message: "Failed to create report" });
    }
  });

  app.patch("/api/reports/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      if (!["reported", "verified", "responding", "resolved"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const report = await storage.updateDisasterReportStatus(req.params.id, status);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Broadcast status update to all connected WebSocket clients
      broadcastToAll({ type: "report_updated", data: report });

      res.json(report);
    } catch (error) {
      console.error("Error updating report status:", error);
      res.status(500).json({ message: "Failed to update report status" });
    }
  });

  // Verification routes
  app.post("/api/reports/:reportId/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { reportId } = req.params;

      // Check if user already verified this report
      const existingVerification = await storage.getUserVerificationForReport(
        userId,
        reportId
      );
      if (existingVerification) {
        return res.status(400).json({ message: "You have already verified this report" });
      }

      // Check if report exists
      const report = await storage.getDisasterReport(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      const validatedData = insertVerificationSchema.parse({
        userId,
        reportId,
      });

      const verification = await storage.createVerification(validatedData);
      await storage.incrementReportVerificationCount(reportId);

      // Get updated report and broadcast
      const updatedReport = await storage.getDisasterReport(reportId);
      if (updatedReport) {
        broadcastToAll({ type: "report_verified", data: updatedReport });
      }

      res.status(201).json(verification);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating verification:", error);
      res.status(500).json({ message: "Failed to create verification" });
    }
  });

  app.get("/api/reports/:reportId/verification-count", async (req, res) => {
    try {
      const count = await storage.getVerificationCountForReport(req.params.reportId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching verification count:", error);
      res.status(500).json({ message: "Failed to fetch verification count" });
    }
  });

  // Confirmation routes (for NGO/volunteer users)
  app.post("/api/reports/:reportId/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { reportId } = req.params;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only volunteer, NGO, or admin users can confirm reports
      if (!user.role || !["volunteer", "ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only verified volunteers, NGOs, and admins can confirm reports" 
        });
      }

      // Check if report exists
      const report = await storage.getDisasterReport(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Confirm the report
      const confirmedReport = await storage.confirmReport(reportId, userId);
      
      // Broadcast confirmation to all connected WebSocket clients
      if (confirmedReport) {
        broadcastToAll({ type: "report_confirmed", data: confirmedReport });
      }

      res.json(confirmedReport);
    } catch (error) {
      console.error("Error confirming report:", error);
      res.status(500).json({ message: "Failed to confirm report" });
    }
  });

  app.delete("/api/reports/:reportId/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { reportId } = req.params;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only volunteer, NGO, or admin users can unconfirm reports
      if (!user.role || !["volunteer", "ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only verified volunteers, NGOs, and admins can unconfirm reports" 
        });
      }

      // Check if report exists
      const report = await storage.getDisasterReport(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Unconfirm the report
      const unconfirmedReport = await storage.unconfirmReport(reportId);
      
      // Broadcast unconfirmation to all connected WebSocket clients
      if (unconfirmedReport) {
        broadcastToAll({ type: "report_unconfirmed", data: unconfirmedReport });
      }

      res.json(unconfirmedReport);
    } catch (error) {
      console.error("Error unconfirming report:", error);
      res.status(500).json({ message: "Failed to unconfirm report" });
    }
  });

  // Admin routes for disaster management
  app.post("/api/admin/reports/:reportId/flag", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { reportId } = req.params;
      const { flagType, adminNotes } = req.body;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin and NGO users can flag reports
      if (!user.role || !["ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only NGOs and admins can flag reports" 
        });
      }

      // Validate flag type
      const validFlagTypes = ["false_report", "duplicate", "spam"];
      if (!validFlagTypes.includes(flagType)) {
        return res.status(400).json({ message: "Invalid flag type" });
      }

      const report = await storage.flagReport(reportId, flagType, userId, adminNotes);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Broadcast flag update to all connected WebSocket clients
      broadcastToAll({ type: "report_flagged", data: report });

      res.json(report);
    } catch (error) {
      console.error("Error flagging report:", error);
      res.status(500).json({ message: "Failed to flag report" });
    }
  });

  app.delete("/api/admin/reports/:reportId/flag", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { reportId } = req.params;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin and NGO users can unflag reports
      if (!user.role || !["ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only NGOs and admins can unflag reports" 
        });
      }

      const report = await storage.unflagReport(reportId);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Broadcast unflag update to all connected WebSocket clients
      broadcastToAll({ type: "report_unflagged", data: report });

      res.json(report);
    } catch (error) {
      console.error("Error unflagging report:", error);
      res.status(500).json({ message: "Failed to unflag report" });
    }
  });

  app.patch("/api/admin/reports/:reportId/notes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { reportId } = req.params;
      const { notes } = req.body;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin and NGO users can add admin notes
      if (!user.role || !["ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only NGOs and admins can add admin notes" 
        });
      }

      if (!notes || typeof notes !== "string") {
        return res.status(400).json({ message: "Notes are required" });
      }

      const report = await storage.addAdminNotes(reportId, notes);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.json(report);
    } catch (error) {
      console.error("Error adding admin notes:", error);
      res.status(500).json({ message: "Failed to add admin notes" });
    }
  });

  app.post("/api/admin/reports/:reportId/assign", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { reportId } = req.params;
      const { volunteerId } = req.body;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin and NGO users can assign reports
      if (!user.role || !["ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only NGOs and admins can assign reports" 
        });
      }

      if (!volunteerId) {
        return res.status(400).json({ message: "Volunteer ID is required" });
      }

      // Verify the volunteer exists and has appropriate role
      const volunteer = await storage.getUser(volunteerId);
      if (!volunteer) {
        return res.status(404).json({ message: "Volunteer not found" });
      }

      if (!volunteer.role || !["volunteer", "ngo", "admin"].includes(volunteer.role)) {
        return res.status(400).json({ 
          message: "User must be a volunteer, NGO, or admin to be assigned" 
        });
      }

      const report = await storage.assignReportToVolunteer(reportId, volunteerId);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Broadcast assignment to all connected WebSocket clients
      broadcastToAll({ type: "report_assigned", data: report });

      res.json(report);
    } catch (error) {
      console.error("Error assigning report:", error);
      res.status(500).json({ message: "Failed to assign report" });
    }
  });

  app.delete("/api/admin/reports/:reportId/assign", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { reportId } = req.params;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin and NGO users can unassign reports
      if (!user.role || !["ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only NGOs and admins can unassign reports" 
        });
      }

      const report = await storage.unassignReport(reportId);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Broadcast unassignment to all connected WebSocket clients
      broadcastToAll({ type: "report_unassigned", data: report });

      res.json(report);
    } catch (error) {
      console.error("Error unassigning report:", error);
      res.status(500).json({ message: "Failed to unassign report" });
    }
  });

  app.get("/api/admin/reports/filter/:status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { status } = req.params;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin and NGO users can access filtered reports
      if (!user.role || !["ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only NGOs and admins can access filtered reports" 
        });
      }

      // Validate status
      const validStatuses = ["reported", "verified", "responding", "resolved"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const reports = await storage.getReportsByStatus(status as "reported" | "verified" | "responding" | "resolved");
      res.json(reports);
    } catch (error) {
      console.error("Error fetching filtered reports:", error);
      res.status(500).json({ message: "Failed to fetch filtered reports" });
    }
  });

  app.get("/api/admin/reports/flagged", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin and NGO users can access flagged reports
      if (!user.role || !["ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only NGOs and admins can access flagged reports" 
        });
      }

      const reports = await storage.getFlaggedReports();
      res.json(reports);
    } catch (error) {
      console.error("Error fetching flagged reports:", error);
      res.status(500).json({ message: "Failed to fetch flagged reports" });
    }
  });

  app.get("/api/admin/reports/prioritized", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin and NGO users can access prioritized reports
      if (!user.role || !["ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only NGOs and admins can access prioritized reports" 
        });
      }

      const reports = await storage.getPrioritizedReports();
      res.json(reports);
    } catch (error) {
      console.error("Error fetching prioritized reports:", error);
      res.status(500).json({ message: "Failed to fetch prioritized reports" });
    }
  });

  // Resource request routes
  app.get("/api/resource-requests", async (req, res) => {
    try {
      const requests = await storage.getAllResourceRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching resource requests:", error);
      res.status(500).json({ message: "Failed to fetch resource requests" });
    }
  });

  app.get("/api/resource-requests/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getResourceRequestsByUser(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching user resource requests:", error);
      res.status(500).json({ message: "Failed to fetch user resource requests" });
    }
  });

  app.get("/api/resource-requests/:requestId", async (req, res) => {
    try {
      const { requestId } = req.params;
      const request = await storage.getResourceRequest(requestId);
      
      if (!request) {
        return res.status(404).json({ message: "Resource request not found" });
      }
      
      res.json(request);
    } catch (error) {
      console.error("Error fetching resource request:", error);
      res.status(500).json({ message: "Failed to fetch resource request" });
    }
  });

  app.post("/api/resource-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertResourceRequestSchema.parse({
        ...req.body,
        userId,
      });

      const resourceRequest = await storage.createResourceRequest(validatedData);
      
      // Broadcast new resource request to all connected WebSocket clients
      broadcastToAll({ type: "new_resource_request", data: resourceRequest });

      res.status(201).json(resourceRequest);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating resource request:", error);
      res.status(500).json({ message: "Failed to create resource request" });
    }
  });

  app.patch("/api/resource-requests/:requestId/status", isAuthenticated, async (req: any, res) => {
    try {
      const { requestId } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = ["pending", "in_progress", "fulfilled", "cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const request = await storage.updateResourceRequestStatus(requestId, status);
      
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

  app.post("/api/resource-requests/:requestId/fulfill", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { requestId } = req.params;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only volunteer, NGO, or admin users can fulfill requests
      if (!user.role || !["volunteer", "ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only verified volunteers, NGOs, and admins can fulfill requests" 
        });
      }

      const request = await storage.fulfillResourceRequest(requestId, userId);
      
      if (!request) {
        return res.status(404).json({ message: "Resource request not found" });
      }

      // Broadcast fulfillment to all connected WebSocket clients
      broadcastToAll({ type: "resource_request_fulfilled", data: request });

      res.json(request);
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
      const availableOffers = await storage.getAvailableAidOffers();
      
      // Use AI matching service to find best matches
      const matchingService = new AIMatchingService();
      const matches = await matchingService.findMatchesForRequest(request, availableOffers);
      
      res.json(matches);
    } catch (error) {
      console.error("Error finding matches for resource request:", error);
      res.status(500).json({ message: "Failed to find matches" });
    }
  });

  // Aid offer routes
  app.get("/api/aid-offers", isAuthenticated, async (req, res) => {
    try {
      const offers = await storage.getAllAidOffers();
      // Sanitize contact info for non-owners
      const sanitized = offers.map(offer => ({
        ...offer,
        contactInfo: undefined, // Remove contact info from list view for privacy
      }));
      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching aid offers:", error);
      res.status(500).json({ message: "Failed to fetch aid offers" });
    }
  });

  app.get("/api/aid-offers/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const offers = await storage.getAidOffersByUser(userId);
      res.json(offers);
    } catch (error) {
      console.error("Error fetching user aid offers:", error);
      res.status(500).json({ message: "Failed to fetch user aid offers" });
    }
  });

  app.get("/api/aid-offers/:offerId", isAuthenticated, async (req: any, res) => {
    try {
      const { offerId } = req.params;
      const userId = req.user.claims.sub;
      const offer = await storage.getAidOffer(offerId);
      
      if (!offer) {
        return res.status(404).json({ message: "Aid offer not found" });
      }

      // Only show contact info to the owner or when viewing matches
      const user = await storage.getUser(userId);
      const isOwner = offer.userId === userId;
      const isAuthorized = user?.role && ["volunteer", "ngo", "admin"].includes(user.role);
      
      // Show full details to owner, sanitized to others
      if (!isOwner && !isAuthorized) {
        return res.json({
          ...offer,
          contactInfo: undefined,
        });
      }
      
      res.json(offer);
    } catch (error) {
      console.error("Error fetching aid offer:", error);
      res.status(500).json({ message: "Failed to fetch aid offer" });
    }
  });

  app.post("/api/aid-offers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only volunteer, NGO, or admin users can create aid offers
      if (!user.role || !["volunteer", "ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only verified volunteers, NGOs, and admins can create aid offers" 
        });
      }

      const validatedData = insertAidOfferSchema.parse({
        ...req.body,
        userId,
      });

      const aidOffer = await storage.createAidOffer(validatedData);
      
      // Broadcast new aid offer to all connected WebSocket clients
      broadcastToAll({ type: "new_aid_offer", data: aidOffer });

      res.status(201).json(aidOffer);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating aid offer:", error);
      res.status(500).json({ message: "Failed to create aid offer" });
    }
  });

  app.patch("/api/aid-offers/:offerId/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { offerId } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = ["available", "committed", "delivered", "cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Check if offer exists and user owns it
      const offer = await storage.getAidOffer(offerId);
      if (!offer) {
        return res.status(404).json({ message: "Aid offer not found" });
      }

      if (offer.userId !== userId) {
        return res.status(403).json({ message: "You can only update your own aid offers" });
      }

      const updatedOffer = await storage.updateAidOfferStatus(offerId, status);
      
      // Broadcast status update to all connected WebSocket clients
      broadcastToAll({ type: "aid_offer_updated", data: updatedOffer });

      res.json(updatedOffer);
    } catch (error) {
      console.error("Error updating aid offer status:", error);
      res.status(500).json({ message: "Failed to update aid offer status" });
    }
  });

  app.post("/api/aid-offers/:offerId/commit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { offerId } = req.params;
      const { requestId } = req.body;

      if (!requestId) {
        return res.status(400).json({ message: "requestId is required" });
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

  app.post("/api/aid-offers/:offerId/deliver", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const { offerId } = req.params;
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

  // Object storage routes
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: undefined,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  app.put("/api/objects/media", isAuthenticated, async (req: any, res) => {
    if (!req.body.mediaURL) {
      return res.status(400).json({ error: "mediaURL is required" });
    }

    const userId = req.user.claims.sub;

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.mediaURL,
        {
          owner: userId,
          visibility: "public",
        },
      );

      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting media ACL:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server setup for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

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

  // Helper function to broadcast messages to all connected clients
  function broadcastToAll(message: any) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  return httpServer;
}
