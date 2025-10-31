import type { Express } from "express";
import { storage } from "../db/storage";
import { isAuthenticated } from "../auth/replitAuth";
import { insertDisasterReportSchema, insertVerificationSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { AIValidationService } from "../validators/aiValidation";
import { 
  reportSubmissionLimiter, 
  verificationLimiter,
  authLimiter
} from "../middleware/rateLimiting";
import { AuditLogger } from "../middleware/auditLog";
import { extractPaginationParams, getPaginationOffsets, createPaginatedResponse } from "../utils/pagination";
import { cache, CacheKeys, CacheTTL } from "../utils/cache";
import { logger } from "../utils/logger";

// Placeholder for broadcast function - will be injected via index.ts
let broadcastToAll: (message: any) => void = () => {};

export function setBroadcastFunction(fn: (message: any) => void) {
  broadcastToAll = fn;
}

export function registerReportRoutes(app: Express) {
  // Get all disaster reports with pagination (database-level)
  app.get("/api/reports", async (req, res) => {
    try {
      // Extract pagination parameters
      const paginationParams = extractPaginationParams(req.query);
      const { offset, limit } = getPaginationOffsets(paginationParams.page, paginationParams.limit);
      
      // Create cache key based on pagination and sorting
      const cacheKey = CacheKeys.reports(
        `${offset}_${limit}_${paginationParams.sortBy || 'default'}_${paginationParams.sortOrder}`
      );
      
      // Try to get from cache
      const cached = cache.get<{ reports: any[]; total: number }>(cacheKey);
      if (cached) {
        const paginatedResponse = createPaginatedResponse(
          cached.reports,
          cached.total,
          paginationParams.page,
          paginationParams.limit
        );
        logger.debug("Reports served from cache", { 
          page: paginationParams.page, 
          cacheHit: true,
          total: cached.total,
        });
        return res.json(paginatedResponse);
      }
      
      // Get paginated reports directly from database (efficient!)
      const { reports, total } = await storage.getPaginatedDisasterReports(
        limit,
        offset,
        paginationParams.sortBy,
        paginationParams.sortOrder
      );
      
      // Cache the results for 2 minutes (frequently changing data)
      cache.set(cacheKey, { reports, total }, CacheTTL.SHORT);
      
      const paginatedResponse = createPaginatedResponse(
        reports,
        total,
        paginationParams.page,
        paginationParams.limit
      );
      
      logger.debug("Reports fetched from database with pagination", { 
        page: paginationParams.page, 
        limit,
        offset,
        total,
        cacheHit: false,
        sortBy: paginationParams.sortBy,
        sortOrder: paginationParams.sortOrder,
      });
      
      res.json(paginatedResponse);
    } catch (error) {
      logger.error("Error fetching reports", error as Error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Get specific disaster report with caching
  app.get("/api/reports/:id", async (req, res) => {
    try {
      const reportId = req.params.id;
      const cacheKey = CacheKeys.report(reportId);
      
      // Try to get from cache
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.debug("Report served from cache", { reportId, cacheHit: true });
        return res.json(cached);
      }
      
      const report = await storage.getDisasterReport(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Cache the report for 5 minutes
      cache.set(cacheKey, report, CacheTTL.MEDIUM);
      
      logger.debug("Report fetched from database", { reportId, cacheHit: false });
      res.json(report);
    } catch (error) {
      logger.error("Error fetching report", error as Error, { reportId: req.params.id });
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  // Get user's disaster reports
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

  // Create new disaster report
  app.post("/api/reports", isAuthenticated, reportSubmissionLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertDisasterReportSchema.parse({
        ...req.body,
        userId,
      });

      // Load recent reports once for both AI validation and duplicate detection (performance optimization)
      const recentReports = await storage.getRecentReports(200);
      
      // Run AI validation using recent reports
      const aiService = new AIValidationService();
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
        recentReports
      );

      // Add AI validation results to the report
      const reportWithAI = {
        ...validatedData,
        aiValidationScore: aiValidation.score,
        aiValidationNotes: aiValidation.notes,
      };

      const report = await storage.createDisasterReport(reportWithAI);
      
      // Invalidate reports cache when new report is created
      cache.deletePattern(/^reports:/);
      logger.debug("Invalidated reports cache after creating new report", { reportId: report.id });
      
      // Run automatic duplicate detection using the same recent reports
      const { clusteringService } = await import("../utils/clustering");
      const duplicateCheck = clusteringService.detectDuplicates(report, recentReports);
      
      let finalReport = report;
      if (duplicateCheck.confidence > 0.5) {
        const similarReports = clusteringService.findSimilarReports(report, recentReports);
        const similarIds = similarReports.slice(0, 5).map(s => s.reportId);
        
        if (similarIds.length > 0) {
          // Update the new report with similar IDs
          finalReport = await storage.updateSimilarReports(report.id, similarIds) || report;
          
          // Bidirectionally link: update each similar report to include this new report
          for (const similarId of similarIds) {
            const existingReport = await storage.getDisasterReport(similarId);
            if (existingReport) {
              const updatedSimilarIds = Array.from(new Set([
                ...(existingReport.similarReportIds || []),
                report.id
              ]));
              await storage.updateSimilarReports(similarId, updatedSimilarIds);
            }
          }
        }
      }
      
      // Broadcast new report to all connected WebSocket clients
      broadcastToAll({ 
        type: "new_report", 
        data: finalReport,
        duplicateInfo: duplicateCheck.isDuplicate ? {
          isDuplicate: true,
          confidence: duplicateCheck.confidence,
          reasons: duplicateCheck.reasons,
        } : undefined
      });
      
      res.status(201).json({
        ...finalReport,
        duplicateCheck: {
          hasSimilar: duplicateCheck.confidence > 0.5,
          confidence: duplicateCheck.confidence,
          reasons: duplicateCheck.reasons,
        }
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating report:", error);
      res.status(500).json({ message: "Failed to create report" });
    }
  });

  // Update report status
  app.patch("/api/reports/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      if (!["reported", "verified", "responding", "resolved"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const oldReport = await storage.getDisasterReport(req.params.id);
      const report = await storage.updateDisasterReportStatus(req.params.id, status);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Log status change
      const userId = (req as any).user.claims.sub;
      await AuditLogger.logStatusChange(userId, req.params.id, oldReport?.status || "unknown", status, req);

      // Broadcast status update to all connected WebSocket clients
      broadcastToAll({ type: "report_updated", data: report });

      res.json(report);
    } catch (error) {
      console.error("Error updating report status:", error);
      res.status(500).json({ message: "Failed to update report status" });
    }
  });

  // Verify a report
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

  // Get verification count for a report
  app.get("/api/reports/:reportId/verification-count", async (req, res) => {
    try {
      const count = await storage.getVerificationCountForReport(req.params.reportId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching verification count:", error);
      res.status(500).json({ message: "Failed to fetch verification count" });
    }
  });

  // Confirm a report (NGO/volunteer users)
  app.post("/api/reports/:reportId/confirm", isAuthenticated, verificationLimiter, async (req: any, res) => {
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
      
      // Log confirmation
      await AuditLogger.logReportConfirmation(userId, reportId, req);
      
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

  // Unconfirm a report
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
      
      // Log unconfirmation
      await AuditLogger.logReportUnconfirmation(userId, reportId, req);
      
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

  // Admin: Flag a report
  app.post("/api/admin/reports/:reportId/flag", isAuthenticated, authLimiter, async (req: any, res) => {
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

      // Log flagging action
      await AuditLogger.logReportFlag(userId, reportId, flagType, req);

      // Broadcast flag update to all connected WebSocket clients
      broadcastToAll({ type: "report_flagged", data: report });

      res.json(report);
    } catch (error) {
      console.error("Error flagging report:", error);
      res.status(500).json({ message: "Failed to flag report" });
    }
  });

  // Admin: Unflag a report
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

      // Log unflagging
      await AuditLogger.logReportUnflag(userId, reportId, req);

      // Broadcast unflag update to all connected WebSocket clients
      broadcastToAll({ type: "report_unflagged", data: report });

      res.json(report);
    } catch (error) {
      console.error("Error unflagging report:", error);
      res.status(500).json({ message: "Failed to unflag report" });
    }
  });

  // Admin: Add notes to report
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

  // Admin: Assign report to volunteer
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

      // Log assignment
      await AuditLogger.logReportAssignment(userId, reportId, volunteerId, req);

      // Broadcast assignment to all connected WebSocket clients
      broadcastToAll({ type: "report_assigned", data: report });

      res.json(report);
    } catch (error) {
      console.error("Error assigning report:", error);
      res.status(500).json({ message: "Failed to assign report" });
    }
  });

  // Admin: Unassign report
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

      // Log unassignment
      await AuditLogger.logReportUnassignment(userId, reportId, req);

      // Broadcast unassignment to all connected WebSocket clients
      broadcastToAll({ type: "report_unassigned", data: report });

      res.json(report);
    } catch (error) {
      console.error("Error unassigning report:", error);
      res.status(500).json({ message: "Failed to unassign report" });
    }
  });

  // Admin: Get reports by status
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

  // Admin: Get flagged reports
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

  // Admin: Get prioritized reports
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

  // Admin: Update report priority
  app.patch("/api/admin/reports/:reportId/priority", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { reportId } = req.params;
      const { priorityScore } = req.body;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin and NGO users can update priority
      if (!user.role || !["ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only NGOs and admins can update report priority" 
        });
      }

      if (typeof priorityScore !== "number") {
        return res.status(400).json({ message: "Priority score must be a number" });
      }

      const report = await storage.updateReportPriority(reportId, priorityScore);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.json(report);
    } catch (error) {
      console.error("Error updating report priority:", error);
      res.status(500).json({ message: "Failed to update report priority" });
    }
  });
}
