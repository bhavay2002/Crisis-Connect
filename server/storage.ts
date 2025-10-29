import {
  type User,
  type UpsertUser,
  type DisasterReport,
  type InsertDisasterReport,
  type Verification,
  type InsertVerification,
  type ResourceRequest,
  type InsertResourceRequest,
  type AidOffer,
  type InsertAidOffer,
  users,
  disasterReports,
  verifications,
  resourceRequests,
  aidOffers,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations - Required for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRole(id: string, role: "citizen" | "volunteer" | "ngo" | "admin"): Promise<User | undefined>;
  getAssignableUsers(): Promise<User[]>;

  // Disaster report operations
  getDisasterReport(id: string): Promise<DisasterReport | undefined>;
  getAllDisasterReports(): Promise<DisasterReport[]>;
  getDisasterReportsByUser(userId: string): Promise<DisasterReport[]>;
  createDisasterReport(report: InsertDisasterReport): Promise<DisasterReport>;
  updateDisasterReportStatus(
    id: string,
    status: "reported" | "verified" | "responding" | "resolved"
  ): Promise<DisasterReport | undefined>;

  // Verification operations
  createVerification(verification: InsertVerification): Promise<Verification>;
  getUserVerificationForReport(
    userId: string,
    reportId: string
  ): Promise<Verification | undefined>;
  getUserVerifications(userId: string): Promise<Verification[]>;
  getVerificationCountForReport(reportId: string): Promise<number>;
  incrementReportVerificationCount(reportId: string): Promise<void>;
  
  // Confirmation operations (for NGO/volunteer users)
  confirmReport(reportId: string, userId: string): Promise<DisasterReport | undefined>;
  unconfirmReport(reportId: string): Promise<DisasterReport | undefined>;

  // Admin operations
  flagReport(reportId: string, flagType: "false_report" | "duplicate" | "spam", userId: string, adminNotes?: string): Promise<DisasterReport | undefined>;
  unflagReport(reportId: string): Promise<DisasterReport | undefined>;
  addAdminNotes(reportId: string, notes: string): Promise<DisasterReport | undefined>;
  assignReportToVolunteer(reportId: string, volunteerId: string): Promise<DisasterReport | undefined>;
  unassignReport(reportId: string): Promise<DisasterReport | undefined>;
  getReportsByStatus(status: "reported" | "verified" | "responding" | "resolved"): Promise<DisasterReport[]>;
  getFlaggedReports(): Promise<DisasterReport[]>;
  getPrioritizedReports(): Promise<DisasterReport[]>;
  updateReportPriority(reportId: string, priorityScore: number): Promise<DisasterReport | undefined>;

  // Resource request operations
  createResourceRequest(request: InsertResourceRequest): Promise<ResourceRequest>;
  getResourceRequest(id: string): Promise<ResourceRequest | undefined>;
  getAllResourceRequests(): Promise<ResourceRequest[]>;
  getResourceRequestsByUser(userId: string): Promise<ResourceRequest[]>;
  updateResourceRequestStatus(
    id: string,
    status: "pending" | "in_progress" | "fulfilled" | "cancelled"
  ): Promise<ResourceRequest | undefined>;
  fulfillResourceRequest(id: string, userId: string): Promise<ResourceRequest | undefined>;

  // Aid offer operations
  createAidOffer(offer: InsertAidOffer): Promise<AidOffer>;
  getAidOffer(id: string): Promise<AidOffer | undefined>;
  getAllAidOffers(): Promise<AidOffer[]>;
  getAidOffersByUser(userId: string): Promise<AidOffer[]>;
  getAvailableAidOffers(): Promise<AidOffer[]>;
  updateAidOfferStatus(
    id: string,
    status: "available" | "committed" | "delivered" | "cancelled"
  ): Promise<AidOffer | undefined>;
  matchAidOfferToRequest(offerId: string, requestId: string): Promise<AidOffer | undefined>;
  markAidOfferDelivered(offerId: string): Promise<AidOffer | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserRole(id: string, role: "citizen" | "volunteer" | "ngo" | "admin"): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAssignableUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(sql`${users.role} IN ('volunteer', 'ngo', 'admin')`);
  }

  // Disaster report operations
  async getDisasterReport(id: string): Promise<DisasterReport | undefined> {
    const [report] = await db
      .select()
      .from(disasterReports)
      .where(eq(disasterReports.id, id));
    return report;
  }

  async getAllDisasterReports(): Promise<DisasterReport[]> {
    return await db
      .select()
      .from(disasterReports)
      .orderBy(desc(disasterReports.createdAt));
  }

  async getDisasterReportsByUser(userId: string): Promise<DisasterReport[]> {
    return await db
      .select()
      .from(disasterReports)
      .where(eq(disasterReports.userId, userId))
      .orderBy(desc(disasterReports.createdAt));
  }

  async createDisasterReport(
    insertReport: InsertDisasterReport
  ): Promise<DisasterReport> {
    const [report] = await db
      .insert(disasterReports)
      .values(insertReport)
      .returning();
    return report;
  }

  async updateDisasterReportStatus(
    id: string,
    status: "reported" | "verified" | "responding" | "resolved"
  ): Promise<DisasterReport | undefined> {
    const [report] = await db
      .update(disasterReports)
      .set({ status, updatedAt: new Date() })
      .where(eq(disasterReports.id, id))
      .returning();
    return report;
  }

  // Verification operations
  async createVerification(
    insertVerification: InsertVerification
  ): Promise<Verification> {
    const [verification] = await db
      .insert(verifications)
      .values(insertVerification)
      .returning();
    return verification;
  }

  async getUserVerificationForReport(
    userId: string,
    reportId: string
  ): Promise<Verification | undefined> {
    const [verification] = await db
      .select()
      .from(verifications)
      .where(
        and(
          eq(verifications.userId, userId),
          eq(verifications.reportId, reportId)
        )
      );
    return verification;
  }

  async getUserVerifications(userId: string): Promise<Verification[]> {
    return db
      .select()
      .from(verifications)
      .where(eq(verifications.userId, userId));
  }

  async getVerificationCountForReport(reportId: string): Promise<number> {
    const results = await db
      .select()
      .from(verifications)
      .where(eq(verifications.reportId, reportId));
    return results.length;
  }

  async incrementReportVerificationCount(reportId: string): Promise<void> {
    // Get current count
    const count = await this.getVerificationCountForReport(reportId);
    
    // Update report with new count
    await db
      .update(disasterReports)
      .set({
        verificationCount: count,
        updatedAt: new Date(),
      })
      .where(eq(disasterReports.id, reportId));
  }
  
  // Confirmation operations (for NGO/volunteer users)
  async confirmReport(reportId: string, userId: string): Promise<DisasterReport | undefined> {
    const [report] = await db
      .update(disasterReports)
      .set({
        confirmedBy: userId,
        confirmedAt: new Date(),
        status: "verified",
        updatedAt: new Date(),
      })
      .where(eq(disasterReports.id, reportId))
      .returning();
    return report;
  }
  
  async unconfirmReport(reportId: string): Promise<DisasterReport | undefined> {
    const [report] = await db
      .update(disasterReports)
      .set({
        confirmedBy: null,
        confirmedAt: null,
        status: "reported",
        updatedAt: new Date(),
      })
      .where(eq(disasterReports.id, reportId))
      .returning();
    return report;
  }

  // Admin operations
  async flagReport(
    reportId: string,
    flagType: "false_report" | "duplicate" | "spam",
    userId: string,
    adminNotes?: string
  ): Promise<DisasterReport | undefined> {
    const [report] = await db
      .update(disasterReports)
      .set({
        flagType,
        flaggedBy: userId,
        flaggedAt: new Date(),
        adminNotes: adminNotes || null,
        updatedAt: new Date(),
      })
      .where(eq(disasterReports.id, reportId))
      .returning();
    return report;
  }

  async unflagReport(reportId: string): Promise<DisasterReport | undefined> {
    const [report] = await db
      .update(disasterReports)
      .set({
        flagType: null,
        flaggedBy: null,
        flaggedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(disasterReports.id, reportId))
      .returning();
    return report;
  }

  async addAdminNotes(reportId: string, notes: string): Promise<DisasterReport | undefined> {
    const [report] = await db
      .update(disasterReports)
      .set({
        adminNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(disasterReports.id, reportId))
      .returning();
    return report;
  }

  async assignReportToVolunteer(reportId: string, volunteerId: string): Promise<DisasterReport | undefined> {
    const [report] = await db
      .update(disasterReports)
      .set({
        assignedTo: volunteerId,
        assignedAt: new Date(),
        status: "responding",
        updatedAt: new Date(),
      })
      .where(eq(disasterReports.id, reportId))
      .returning();
    return report;
  }

  async unassignReport(reportId: string): Promise<DisasterReport | undefined> {
    const [report] = await db
      .update(disasterReports)
      .set({
        assignedTo: null,
        assignedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(disasterReports.id, reportId))
      .returning();
    return report;
  }

  async getReportsByStatus(status: "reported" | "verified" | "responding" | "resolved"): Promise<DisasterReport[]> {
    return await db
      .select()
      .from(disasterReports)
      .where(eq(disasterReports.status, status))
      .orderBy(desc(disasterReports.createdAt));
  }

  async getFlaggedReports(): Promise<DisasterReport[]> {
    return await db
      .select()
      .from(disasterReports)
      .where(sql`${disasterReports.flagType} IS NOT NULL`)
      .orderBy(desc(disasterReports.flaggedAt));
  }

  async getPrioritizedReports(): Promise<DisasterReport[]> {
    return await db
      .select()
      .from(disasterReports)
      .where(sql`${disasterReports.flagType} IS NULL`)
      .orderBy(desc(disasterReports.priorityScore), desc(disasterReports.createdAt));
  }

  async updateReportPriority(reportId: string, priorityScore: number): Promise<DisasterReport | undefined> {
    const [report] = await db
      .update(disasterReports)
      .set({
        priorityScore,
        updatedAt: new Date(),
      })
      .where(eq(disasterReports.id, reportId))
      .returning();
    return report;
  }

  // Resource request operations
  async createResourceRequest(request: InsertResourceRequest): Promise<ResourceRequest> {
    const [resourceRequest] = await db
      .insert(resourceRequests)
      .values(request)
      .returning();
    return resourceRequest;
  }

  async getResourceRequest(id: string): Promise<ResourceRequest | undefined> {
    const [request] = await db
      .select()
      .from(resourceRequests)
      .where(eq(resourceRequests.id, id));
    return request;
  }

  async getAllResourceRequests(): Promise<ResourceRequest[]> {
    return db
      .select()
      .from(resourceRequests)
      .orderBy(desc(resourceRequests.createdAt));
  }

  async getResourceRequestsByUser(userId: string): Promise<ResourceRequest[]> {
    return db
      .select()
      .from(resourceRequests)
      .where(eq(resourceRequests.userId, userId))
      .orderBy(desc(resourceRequests.createdAt));
  }

  async updateResourceRequestStatus(
    id: string,
    status: "pending" | "in_progress" | "fulfilled" | "cancelled"
  ): Promise<ResourceRequest | undefined> {
    const [request] = await db
      .update(resourceRequests)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(resourceRequests.id, id))
      .returning();
    return request;
  }

  async fulfillResourceRequest(id: string, userId: string): Promise<ResourceRequest | undefined> {
    const [request] = await db
      .update(resourceRequests)
      .set({
        status: "fulfilled",
        fulfilledBy: userId,
        fulfilledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(resourceRequests.id, id))
      .returning();
    return request;
  }

  // Aid offer operations
  async createAidOffer(offer: InsertAidOffer): Promise<AidOffer> {
    const [aidOffer] = await db
      .insert(aidOffers)
      .values(offer)
      .returning();
    return aidOffer;
  }

  async getAidOffer(id: string): Promise<AidOffer | undefined> {
    const [offer] = await db
      .select()
      .from(aidOffers)
      .where(eq(aidOffers.id, id));
    return offer;
  }

  async getAllAidOffers(): Promise<AidOffer[]> {
    return db
      .select()
      .from(aidOffers)
      .orderBy(desc(aidOffers.createdAt));
  }

  async getAidOffersByUser(userId: string): Promise<AidOffer[]> {
    return db
      .select()
      .from(aidOffers)
      .where(eq(aidOffers.userId, userId))
      .orderBy(desc(aidOffers.createdAt));
  }

  async getAvailableAidOffers(): Promise<AidOffer[]> {
    return db
      .select()
      .from(aidOffers)
      .where(eq(aidOffers.status, "available"))
      .orderBy(desc(aidOffers.createdAt));
  }

  async updateAidOfferStatus(
    id: string,
    status: "available" | "committed" | "delivered" | "cancelled"
  ): Promise<AidOffer | undefined> {
    const [offer] = await db
      .update(aidOffers)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(aidOffers.id, id))
      .returning();
    return offer;
  }

  async matchAidOfferToRequest(offerId: string, requestId: string): Promise<AidOffer | undefined> {
    const [offer] = await db
      .update(aidOffers)
      .set({
        matchedRequestId: requestId,
        status: "committed",
        updatedAt: new Date(),
      })
      .where(eq(aidOffers.id, offerId))
      .returning();
    return offer;
  }

  async markAidOfferDelivered(offerId: string): Promise<AidOffer | undefined> {
    const [offer] = await db
      .update(aidOffers)
      .set({
        status: "delivered",
        deliveredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aidOffers.id, offerId))
      .returning();
    return offer;
  }
}

export const storage = new DatabaseStorage();
