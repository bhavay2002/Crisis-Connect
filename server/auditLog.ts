import { storage } from "./storage";

export type AuditAction = 
  | "role_updated"
  | "report_confirmed"
  | "report_unconfirmed"
  | "report_flagged"
  | "report_unflagged"
  | "report_assigned"
  | "report_unassigned"
  | "report_status_changed"
  | "resource_request_fulfilled"
  | "aid_offer_status_changed"
  | "user_created"
  | "user_deleted"
  | "sensitive_data_accessed";

export interface AuditLogEntry {
  action: AuditAction;
  userId: string;
  targetId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditLogger {
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        ...entry,
      };
      
      console.log(`[AUDIT] ${JSON.stringify(logEntry)}`);
      
    } catch (error) {
      console.error("Failed to write audit log:", error);
    }
  }

  static async logRoleUpdate(
    adminId: string,
    targetUserId: string,
    oldRole: string,
    newRole: string,
    req?: any
  ): Promise<void> {
    await this.log({
      action: "role_updated",
      userId: adminId,
      targetId: targetUserId,
      metadata: { oldRole, newRole },
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    });
  }

  static async logReportConfirmation(
    userId: string,
    reportId: string,
    req?: any
  ): Promise<void> {
    await this.log({
      action: "report_confirmed",
      userId,
      targetId: reportId,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    });
  }

  static async logReportUnconfirmation(
    userId: string,
    reportId: string,
    req?: any
  ): Promise<void> {
    await this.log({
      action: "report_unconfirmed",
      userId,
      targetId: reportId,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    });
  }

  static async logReportFlag(
    userId: string,
    reportId: string,
    reason: string,
    req?: any
  ): Promise<void> {
    await this.log({
      action: "report_flagged",
      userId,
      targetId: reportId,
      metadata: { reason },
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    });
  }

  static async logReportUnflag(
    userId: string,
    reportId: string,
    req?: any
  ): Promise<void> {
    await this.log({
      action: "report_unflagged",
      userId,
      targetId: reportId,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    });
  }

  static async logReportAssignment(
    adminId: string,
    reportId: string,
    assignedToId: string,
    req?: any
  ): Promise<void> {
    await this.log({
      action: "report_assigned",
      userId: adminId,
      targetId: reportId,
      metadata: { assignedToId },
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    });
  }

  static async logReportUnassignment(
    adminId: string,
    reportId: string,
    req?: any
  ): Promise<void> {
    await this.log({
      action: "report_unassigned",
      userId: adminId,
      targetId: reportId,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    });
  }

  static async logStatusChange(
    userId: string,
    reportId: string,
    oldStatus: string,
    newStatus: string,
    req?: any
  ): Promise<void> {
    await this.log({
      action: "report_status_changed",
      userId,
      targetId: reportId,
      metadata: { oldStatus, newStatus },
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    });
  }

  static async logResourceFulfillment(
    userId: string,
    requestId: string,
    req?: any
  ): Promise<void> {
    await this.log({
      action: "resource_request_fulfilled",
      userId,
      targetId: requestId,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    });
  }

  static async logSensitiveDataAccess(
    userId: string,
    resource: string,
    req?: any
  ): Promise<void> {
    await this.log({
      action: "sensitive_data_accessed",
      userId,
      metadata: { resource },
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
    });
  }
}
