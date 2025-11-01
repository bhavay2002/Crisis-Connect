import { storage } from "../db/storage";
import type { 
  DisasterReport, 
  InsertDisasterReport, 
  InsertVerification,
  Verification 
} from "@shared/schema";
import { logger } from "../utils/logger";

export interface PaginatedReportsResult {
  reports: DisasterReport[];
  total: number;
}

export class ReportRepository {
  async findById(id: string): Promise<DisasterReport | undefined> {
    logger.debug("Finding report by ID", { id });
    return storage.getDisasterReport(id);
  }

  async findAll(): Promise<DisasterReport[]> {
    logger.debug("Finding all reports");
    return storage.getAllDisasterReports();
  }

  async findPaginated(
    limit: number,
    offset: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Promise<PaginatedReportsResult> {
    logger.debug("Finding paginated reports", { limit, offset, sortBy, sortOrder });
    return storage.getPaginatedDisasterReports(limit, offset, sortBy, sortOrder);
  }

  async findByUserId(userId: string): Promise<DisasterReport[]> {
    logger.debug("Finding reports by user", { userId });
    return storage.getDisasterReportsByUser(userId);
  }

  async findByStatus(status: "reported" | "verified" | "responding" | "resolved"): Promise<DisasterReport[]> {
    logger.debug("Finding reports by status", { status });
    return storage.getReportsByStatus(status);
  }

  async findFlagged(): Promise<DisasterReport[]> {
    logger.debug("Finding flagged reports");
    return storage.getFlaggedReports();
  }

  async findPrioritized(): Promise<DisasterReport[]> {
    logger.debug("Finding prioritized reports");
    return storage.getPrioritizedReports();
  }

  async create(report: InsertDisasterReport): Promise<DisasterReport> {
    logger.debug("Creating new report", { type: report.type, severity: report.severity });
    return storage.createDisasterReport(report);
  }

  async updateStatus(
    id: string,
    status: "reported" | "verified" | "responding" | "resolved"
  ): Promise<DisasterReport | undefined> {
    logger.debug("Updating report status", { id, status });
    return storage.updateDisasterReportStatus(id, status);
  }

  async updatePriority(id: string, priorityScore: number): Promise<DisasterReport | undefined> {
    logger.debug("Updating report priority", { id, priorityScore });
    return storage.updateReportPriority(id, priorityScore);
  }

  async confirm(reportId: string, userId: string): Promise<DisasterReport | undefined> {
    logger.debug("Confirming report", { reportId, userId });
    return storage.confirmReport(reportId, userId);
  }

  async unconfirm(reportId: string): Promise<DisasterReport | undefined> {
    logger.debug("Unconfirming report", { reportId });
    return storage.unconfirmReport(reportId);
  }

  async flag(
    reportId: string,
    flagType: "false_report" | "duplicate" | "spam",
    userId: string,
    adminNotes?: string
  ): Promise<DisasterReport | undefined> {
    logger.debug("Flagging report", { reportId, flagType, userId });
    return storage.flagReport(reportId, flagType, userId, adminNotes);
  }

  async unflag(reportId: string): Promise<DisasterReport | undefined> {
    logger.debug("Unflagging report", { reportId });
    return storage.unflagReport(reportId);
  }

  async addAdminNotes(reportId: string, notes: string): Promise<DisasterReport | undefined> {
    logger.debug("Adding admin notes to report", { reportId });
    return storage.addAdminNotes(reportId, notes);
  }

  async assignToVolunteer(reportId: string, volunteerId: string): Promise<DisasterReport | undefined> {
    logger.debug("Assigning report to volunteer", { reportId, volunteerId });
    return storage.assignReportToVolunteer(reportId, volunteerId);
  }

  async unassign(reportId: string): Promise<DisasterReport | undefined> {
    logger.debug("Unassigning report", { reportId });
    return storage.unassignReport(reportId);
  }

  async createVerification(verification: InsertVerification): Promise<Verification> {
    logger.debug("Creating verification", { reportId: verification.reportId, userId: verification.userId });
    return storage.createVerification(verification);
  }

  async findUserVerificationForReport(userId: string, reportId: string): Promise<Verification | undefined> {
    logger.debug("Finding user verification for report", { userId, reportId });
    return storage.getUserVerificationForReport(userId, reportId);
  }

  async findUserVerifications(userId: string): Promise<Verification[]> {
    logger.debug("Finding user verifications", { userId });
    return storage.getUserVerifications(userId);
  }

  async getVerificationCount(reportId: string): Promise<number> {
    logger.debug("Getting verification count for report", { reportId });
    return storage.getVerificationCountForReport(reportId);
  }

  async incrementVerificationCount(reportId: string): Promise<void> {
    logger.debug("Incrementing verification count", { reportId });
    return storage.incrementReportVerificationCount(reportId);
  }

  async getRecentReports(limit: number): Promise<DisasterReport[]> {
    logger.debug("Getting recent reports", { limit });
    return storage.getRecentReports(limit);
  }

  async updateSimilarReports(reportId: string, similarIds: string[]): Promise<DisasterReport | undefined> {
    logger.debug("Updating similar reports", { reportId, similarCount: similarIds.length });
    return storage.updateSimilarReports(reportId, similarIds);
  }
}

export const reportRepository = new ReportRepository();
