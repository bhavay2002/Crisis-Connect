import { storage } from "../db/storage";
import type { DisasterReport, InsertDisasterReport, InsertVerification } from "@shared/schema";
import type { PaginationParams } from "@shared/pagination";
import type { ReportFilter } from "@shared/filtering";
import { AIValidationService } from "../validators/aiValidation";
import { clusteringService } from "../utils/clustering";
import { logger } from "../utils/logger";
import { NotFoundError, ConflictError } from "../errors/AppError";

export interface DuplicateCheckResult {
  hasSimilar: boolean;
  confidence: number;
  reasons: string[];
  similarIds?: string[];
}

export interface ReportWithDuplicateInfo extends DisasterReport {
  duplicateCheck?: DuplicateCheckResult;
}

export interface ReportQueryResult {
  data: DisasterReport[];
  total: number;
}

export interface ReportQueryParams extends PaginationParams {
  filter?: ReportFilter;
}

export class ReportService {
  private aiService: AIValidationService;

  constructor() {
    this.aiService = new AIValidationService();
  }

  async getAllReports(params?: ReportQueryParams): Promise<ReportQueryResult> {
    logger.debug("Fetching all disaster reports", { params });
    
    let reports = await storage.getAllDisasterReports();
    
    // Apply filters if provided
    if (params?.filter) {
      reports = this.applyFilters(reports, params.filter);
    }
    
    const total = reports.length;
    
    // Apply pagination if provided
    if (params) {
      const { page, limit, sortBy, sortOrder } = params;
      const offset = (page - 1) * limit;
      
      // Apply sorting
      if (sortBy) {
        reports = this.sortReports(reports, sortBy, sortOrder);
      }
      
      // Apply pagination
      reports = reports.slice(offset, offset + limit);
    }
    
    return { data: reports, total };
  }

  private applyFilters(reports: DisasterReport[], filter: ReportFilter): DisasterReport[] {
    return reports.filter(report => {
      if (filter.status && report.status !== filter.status) return false;
      if (filter.type && report.type !== filter.type) return false;
      if (filter.severity && report.severity !== filter.severity) return false;
      if (filter.userId && report.userId !== filter.userId) return false;
      if (filter.location && !report.location.toLowerCase().includes(filter.location.toLowerCase())) return false;
      if (filter.isFlagged !== undefined && (report.flagType !== null) !== filter.isFlagged) return false;
      if (filter.isConfirmed !== undefined && (report.confirmedAt !== null) !== filter.isConfirmed) return false;
      if (filter.minAIScore && (report.aiValidationScore || 0) < filter.minAIScore) return false;
      
      // Date range filters
      const createdAt = new Date(report.createdAt);
      if (filter.startDate && createdAt < filter.startDate) return false;
      if (filter.endDate && createdAt > filter.endDate) return false;
      
      return true;
    });
  }

  private sortReports(reports: DisasterReport[], sortBy: string, sortOrder: "asc" | "desc"): DisasterReport[] {
    return reports.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      
      if (aVal === bVal) return 0;
      
      const comparison = aVal > bVal ? 1 : -1;
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }

  async getReportById(id: string): Promise<DisasterReport> {
    const report = await storage.getDisasterReport(id);
    if (!report) {
      throw new NotFoundError("Report");
    }
    return report;
  }

  async getReportsByUser(userId: string): Promise<DisasterReport[]> {
    logger.debug("Fetching reports for user", { userId });
    return storage.getDisasterReportsByUser(userId);
  }

  async getReportsByStatus(status: "reported" | "verified" | "responding" | "resolved"): Promise<DisasterReport[]> {
    logger.debug("Fetching reports by status", { status });
    return storage.getReportsByStatus(status);
  }

  async getFlaggedReports(): Promise<DisasterReport[]> {
    logger.debug("Fetching flagged reports");
    return storage.getFlaggedReports();
  }

  async getPrioritizedReports(): Promise<DisasterReport[]> {
    logger.debug("Fetching prioritized reports");
    return storage.getPrioritizedReports();
  }

  async createReport(data: InsertDisasterReport): Promise<ReportWithDuplicateInfo> {
    logger.info("Creating new disaster report", { 
      userId: data.userId, 
      type: data.type,
      severity: data.severity 
    });

    const recentReports = await storage.getRecentReports(200);
    
    const aiValidation = await this.aiService.validateReport(
      {
        title: data.title,
        description: data.description,
        type: data.type,
        severity: data.severity,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
      },
      recentReports
    );

    const reportWithAI = {
      ...data,
      aiValidationScore: aiValidation.score,
      aiValidationNotes: aiValidation.notes,
    };

    const report = await storage.createDisasterReport(reportWithAI);
    
    const duplicateCheck = await this.detectAndLinkDuplicates(report, recentReports);
    
    logger.info("Report created successfully", { 
      reportId: report.id,
      hasSimilar: duplicateCheck.hasSimilar
    });

    return {
      ...report,
      duplicateCheck,
    };
  }

  async updateReportStatus(
    id: string,
    status: "reported" | "verified" | "responding" | "resolved"
  ): Promise<DisasterReport> {
    logger.info("Updating report status", { reportId: id, status });
    
    const report = await storage.updateDisasterReportStatus(id, status);
    if (!report) {
      throw new NotFoundError("Report");
    }
    
    return report;
  }

  async verifyReport(userId: string, reportId: string): Promise<DisasterReport> {
    logger.info("Verifying report", { userId, reportId });
    
    const existingVerification = await storage.getUserVerificationForReport(userId, reportId);
    if (existingVerification) {
      throw new ConflictError("You have already verified this report");
    }

    const report = await storage.getDisasterReport(reportId);
    if (!report) {
      throw new NotFoundError("Report");
    }

    const verification: InsertVerification = { userId, reportId };
    await storage.createVerification(verification);
    await storage.incrementReportVerificationCount(reportId);

    const updatedReport = await storage.getDisasterReport(reportId);
    if (!updatedReport) {
      throw new NotFoundError("Report");
    }

    return updatedReport;
  }


  async confirmReport(reportId: string, userId: string): Promise<DisasterReport> {
    logger.info("Confirming report", { reportId, userId });
    
    const report = await storage.confirmReport(reportId, userId);
    if (!report) {
      throw new NotFoundError("Report");
    }
    
    return report;
  }

  async unconfirmReport(reportId: string): Promise<DisasterReport> {
    logger.info("Unconfirming report", { reportId });
    
    const report = await storage.unconfirmReport(reportId);
    if (!report) {
      throw new NotFoundError("Report");
    }
    
    return report;
  }

  async flagReport(
    reportId: string,
    flagType: "false_report" | "duplicate" | "spam",
    userId: string,
    adminNotes?: string
  ): Promise<DisasterReport> {
    logger.info("Flagging report", { reportId, flagType, userId });
    
    const report = await storage.flagReport(reportId, flagType, userId, adminNotes);
    if (!report) {
      throw new NotFoundError("Report");
    }
    
    return report;
  }

  async unflagReport(reportId: string): Promise<DisasterReport> {
    logger.info("Unflagging report", { reportId });
    
    const report = await storage.unflagReport(reportId);
    if (!report) {
      throw new NotFoundError("Report");
    }
    
    return report;
  }

  async assignReport(reportId: string, volunteerId: string): Promise<DisasterReport> {
    logger.info("Assigning report to volunteer", { reportId, volunteerId });
    
    const report = await storage.assignReportToVolunteer(reportId, volunteerId);
    if (!report) {
      throw new NotFoundError("Report");
    }
    
    return report;
  }

  async unassignReport(reportId: string): Promise<DisasterReport> {
    logger.info("Unassigning report", { reportId });
    
    const report = await storage.unassignReport(reportId);
    if (!report) {
      throw new NotFoundError("Report");
    }
    
    return report;
  }

  async updatePriority(reportId: string, priorityScore: number): Promise<DisasterReport> {
    logger.info("Updating report priority", { reportId, priorityScore });
    
    const report = await storage.updateReportPriority(reportId, priorityScore);
    if (!report) {
      throw new NotFoundError("Report");
    }
    
    return report;
  }

  async addAdminNotes(reportId: string, notes: string): Promise<DisasterReport> {
    logger.info("Adding admin notes to report", { reportId });
    
    const report = await storage.addAdminNotes(reportId, notes);
    if (!report) {
      throw new NotFoundError("Report");
    }
    
    return report;
  }

  private async detectAndLinkDuplicates(
    report: DisasterReport,
    recentReports: DisasterReport[]
  ): Promise<DuplicateCheckResult> {
    const duplicateCheck = clusteringService.detectDuplicates(report, recentReports);
    
    if (duplicateCheck.confidence > 0.5) {
      const similarReports = clusteringService.findSimilarReports(report, recentReports);
      const similarIds = similarReports.slice(0, 5).map(s => s.reportId);
      
      if (similarIds.length > 0) {
        await storage.updateSimilarReports(report.id, similarIds);
        
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

        return {
          hasSimilar: true,
          confidence: duplicateCheck.confidence,
          reasons: duplicateCheck.reasons,
          similarIds,
        };
      }
    }

    return {
      hasSimilar: false,
      confidence: duplicateCheck.confidence,
      reasons: duplicateCheck.reasons,
    };
  }
}

export const reportService = new ReportService();
