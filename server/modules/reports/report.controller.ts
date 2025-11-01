import type { Request, Response } from "express";
import { reportService } from "./report.service";
import { insertDisasterReportSchema } from "@shared/schema";
import { validatePagination, createPaginatedResponse } from "@shared/pagination";
import { reportFilterSchema } from "@shared/filtering";
import { generateETag, isModified } from "@shared/changeTracking";
import { logger } from "../../utils/logger";
import { ForbiddenError, ValidationError } from "../../errors/AppError";
import { AuditLogger } from "../../middleware/auditLog";

export class ReportController {
  private broadcast?: (message: any) => void;

  setBroadcast(fn: (message: any) => void): void {
    this.broadcast = fn;
  }

  async getAllReports(req: Request, res: Response): Promise<void> {
    const paginationParams = validatePagination(req.query);
    const filterValidation = reportFilterSchema.safeParse(req.query);
    
    const filter = filterValidation.success ? filterValidation.data : undefined;
    
    const { data, total } = await reportService.getAllReports({
      ...paginationParams,
      filter,
    });
    
    const response = createPaginatedResponse(data, total, paginationParams);
    res.json(response);
  }

  async getReportById(req: Request, res: Response): Promise<void> {
    const report = await reportService.getReportById(req.params.id);
    
    // Generate ETag for caching
    const etag = generateETag(report);
    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", report.updatedAt.toUTCString());
    
    // Check If-None-Match header
    const ifNoneMatch = req.headers["if-none-match"];
    if (ifNoneMatch === etag) {
      res.status(304).send();
      return;
    }
    
    // Check If-Modified-Since header
    const ifModifiedSince = req.headers["if-modified-since"];
    if (ifModifiedSince) {
      const modifiedDate = new Date(ifModifiedSince);
      const reportDate = new Date(report.updatedAt);
      if (reportDate <= modifiedDate) {
        res.status(304).send();
        return;
      }
    }
    
    res.json(report);
  }

  async getReportsByUser(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.claims.sub;
    const requestedUserId = req.params.userId;
    
    if (userId !== requestedUserId) {
      throw new ForbiddenError("You can only access your own reports");
    }
    
    const reports = await reportService.getReportsByUser(requestedUserId);
    res.json(reports);
  }

  async getReportsByStatus(req: Request, res: Response): Promise<void> {
    const { status } = req.params;
    
    if (!["reported", "verified", "responding", "resolved"].includes(status)) {
      throw new ValidationError("Invalid status");
    }
    
    const reports = await reportService.getReportsByStatus(
      status as "reported" | "verified" | "responding" | "resolved"
    );
    res.json(reports);
  }

  async getFlaggedReports(req: Request, res: Response): Promise<void> {
    const reports = await reportService.getFlaggedReports();
    res.json(reports);
  }

  async getPrioritizedReports(req: Request, res: Response): Promise<void> {
    const reports = await reportService.getPrioritizedReports();
    res.json(reports);
  }

  async createReport(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.claims.sub;
    
    const validation = insertDisasterReportSchema.safeParse({
      ...req.body,
      userId,
    });

    if (!validation.success) {
      const errorMessage = validation.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new ValidationError(errorMessage, { errors: validation.error.errors });
    }

    const report = await reportService.createReport(validation.data);
    
    this.broadcast?.({ 
      type: "new_report", 
      data: report,
      duplicateInfo: report.duplicateCheck?.hasSimilar ? {
        isDuplicate: true,
        confidence: report.duplicateCheck.confidence,
        reasons: report.duplicateCheck.reasons,
      } : undefined
    });
    
    res.status(201).json(report);
  }

  async updateReportStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!["reported", "verified", "responding", "resolved"].includes(status)) {
      throw new ValidationError("Invalid status");
    }

    const oldReport = await reportService.getReportById(id);
    const report = await reportService.updateReportStatus(id, status);

    const userId = (req as any).user.claims.sub;
    await AuditLogger.logStatusChange(userId, id, oldReport.status, status, req);

    this.broadcast?.({ type: "report_updated", data: report });

    res.json(report);
  }

  async verifyReport(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.claims.sub;
    const { reportId } = req.params;

    await reportService.verifyReport(userId, reportId);
    const updatedReport = await reportService.getReportById(reportId);
    
    this.broadcast?.({ type: "report_verified", data: updatedReport });
    
    res.status(201).json({ success: true, report: updatedReport });
  }


  async confirmReport(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.claims.sub;
    const { reportId } = req.params;

    const report = await reportService.confirmReport(reportId, userId);
    
    this.broadcast?.({ type: "report_confirmed", data: report });
    
    res.json(report);
  }

  async unconfirmReport(req: Request, res: Response): Promise<void> {
    const { reportId } = req.params;

    const report = await reportService.unconfirmReport(reportId);
    
    this.broadcast?.({ type: "report_unconfirmed", data: report });
    
    res.json(report);
  }

  async flagReport(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.claims.sub;
    const { reportId } = req.params;
    const { flagType, adminNotes } = req.body;
    
    if (!["false_report", "duplicate", "spam"].includes(flagType)) {
      throw new ValidationError("Invalid flag type");
    }

    const report = await reportService.flagReport(reportId, flagType, userId, adminNotes);
    
    await AuditLogger.logReportFlag(userId, reportId, flagType, req);
    this.broadcast?.({ type: "report_flagged", data: report });
    
    res.json(report);
  }

  async unflagReport(req: Request, res: Response): Promise<void> {
    const { reportId } = req.params;

    const report = await reportService.unflagReport(reportId);
    
    this.broadcast?.({ type: "report_unflagged", data: report });
    
    res.json(report);
  }

  async assignReport(req: Request, res: Response): Promise<void> {
    const { reportId } = req.params;
    const { volunteerId } = req.body;
    
    if (!volunteerId) {
      throw new ValidationError("Volunteer ID is required");
    }

    const report = await reportService.assignReport(reportId, volunteerId);
    
    this.broadcast?.({ type: "report_assigned", data: report });
    
    res.json(report);
  }

  async unassignReport(req: Request, res: Response): Promise<void> {
    const { reportId } = req.params;

    const report = await reportService.unassignReport(reportId);
    
    this.broadcast?.({ type: "report_unassigned", data: report });
    
    res.json(report);
  }

  async updatePriority(req: Request, res: Response): Promise<void> {
    const { reportId } = req.params;
    const { priorityScore } = req.body;
    
    if (typeof priorityScore !== "number" || priorityScore < 0 || priorityScore > 100) {
      throw new ValidationError("Priority score must be a number between 0 and 100");
    }

    const report = await reportService.updatePriority(reportId, priorityScore);
    
    this.broadcast?.({ type: "report_priority_updated", data: report });
    
    res.json(report);
  }

  async addAdminNotes(req: Request, res: Response): Promise<void> {
    const { reportId } = req.params;
    const { notes } = req.body;
    
    if (!notes || typeof notes !== "string") {
      throw new ValidationError("Admin notes are required");
    }

    const report = await reportService.addAdminNotes(reportId, notes);
    
    res.json(report);
  }
}

export const reportController = new ReportController();
