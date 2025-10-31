import type { Express } from "express";
import { isAuthenticated } from "../auth/replitAuth";
import { reportController } from "../controllers/report.controller";
import { asyncHandler } from "../middleware/errorHandler";
import { 
  reportSubmissionLimiter, 
  verificationLimiter,
  authLimiter
} from "../middleware/rateLimiting";
import { requireRole } from "../middleware/roleAuth";

export function setBroadcastFunction(fn: (message: any) => void) {
  reportController.setBroadcast(fn);
}

export function registerReportRoutes(app: Express) {
  app.get("/api/reports", 
    asyncHandler(reportController.getAllReports.bind(reportController))
  );

  app.get("/api/reports/:id", 
    asyncHandler(reportController.getReportById.bind(reportController))
  );

  app.get("/api/reports/user/:userId", 
    isAuthenticated,
    asyncHandler(reportController.getReportsByUser.bind(reportController))
  );

  app.get("/api/reports/status/:status", 
    asyncHandler(reportController.getReportsByStatus.bind(reportController))
  );

  app.get("/api/reports/flagged/all", 
    isAuthenticated,
    requireRole("admin", "ngo"),
    asyncHandler(reportController.getFlaggedReports.bind(reportController))
  );

  app.get("/api/reports/prioritized/all", 
    isAuthenticated,
    requireRole("admin", "ngo", "volunteer"),
    asyncHandler(reportController.getPrioritizedReports.bind(reportController))
  );

  app.post("/api/reports", 
    isAuthenticated,
    reportSubmissionLimiter,
    asyncHandler(reportController.createReport.bind(reportController))
  );

  app.patch("/api/reports/:id/status", 
    isAuthenticated,
    asyncHandler(reportController.updateReportStatus.bind(reportController))
  );

  app.post("/api/reports/:reportId/verify", 
    isAuthenticated,
    verificationLimiter,
    asyncHandler(reportController.verifyReport.bind(reportController))
  );

  app.post("/api/reports/:reportId/confirm", 
    isAuthenticated,
    requireRole("volunteer", "ngo", "admin"),
    verificationLimiter,
    asyncHandler(reportController.confirmReport.bind(reportController))
  );

  app.delete("/api/reports/:reportId/confirm", 
    isAuthenticated,
    requireRole("volunteer", "ngo", "admin"),
    asyncHandler(reportController.unconfirmReport.bind(reportController))
  );

  app.post("/api/admin/reports/:reportId/flag", 
    isAuthenticated,
    requireRole("ngo", "admin"),
    authLimiter,
    asyncHandler(reportController.flagReport.bind(reportController))
  );

  app.delete("/api/admin/reports/:reportId/flag", 
    isAuthenticated,
    requireRole("ngo", "admin"),
    asyncHandler(reportController.unflagReport.bind(reportController))
  );

  app.post("/api/admin/reports/:reportId/assign", 
    isAuthenticated,
    requireRole("admin", "ngo"),
    asyncHandler(reportController.assignReport.bind(reportController))
  );

  app.delete("/api/admin/reports/:reportId/assign", 
    isAuthenticated,
    requireRole("admin", "ngo"),
    asyncHandler(reportController.unassignReport.bind(reportController))
  );

  app.patch("/api/admin/reports/:reportId/priority", 
    isAuthenticated,
    requireRole("admin", "ngo"),
    asyncHandler(reportController.updatePriority.bind(reportController))
  );

  app.patch("/api/admin/reports/:reportId/notes", 
    isAuthenticated,
    requireRole("admin", "ngo"),
    asyncHandler(reportController.addAdminNotes.bind(reportController))
  );
}
