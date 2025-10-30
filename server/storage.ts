import {
  type User,
  type UpsertUser,
  type DisasterReport,
  type InsertDisasterReport,
  type Verification,
  type InsertVerification,
  type ReportVote,
  type InsertReportVote,
  type ResourceRequest,
  type InsertResourceRequest,
  type AidOffer,
  type InsertAidOffer,
  type InventoryItem,
  type InsertInventoryItem,
  type AnalyticsEvent,
  type InsertAnalyticsEvent,
  type UserReputation,
  type InsertUserReputation,
  type SOSAlert,
  type InsertSOSAlert,
  type ChatRoom,
  type InsertChatRoom,
  type ChatRoomMember,
  type InsertChatRoomMember,
  type Message,
  type InsertMessage,
  type Notification,
  type InsertNotification,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  users,
  disasterReports,
  verifications,
  reportVotes,
  resourceRequests,
  aidOffers,
  inventoryItems,
  analyticsEvents,
  userReputation,
  sosAlerts,
  chatRooms,
  chatRoomMembers,
  messages,
  notifications,
  notificationPreferences,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import { encryptMessage, decryptMessage, isEncryptionEnabled } from "./encryption";

export interface IStorage {
  // User operations - Required for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRole(id: string, role: "citizen" | "volunteer" | "ngo" | "admin" | "government"): Promise<User | undefined>;
  getAssignableUsers(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;

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
  
  // Vote operations (community trust rating)
  createOrUpdateVote(vote: InsertReportVote): Promise<ReportVote>;
  getUserVoteForReport(
    userId: string,
    reportId: string
  ): Promise<ReportVote | undefined>;
  getVoteCountsForReport(reportId: string): Promise<{ upvotes: number; downvotes: number }>;
  deleteVote(userId: string, reportId: string): Promise<void>;
  updateReportVoteCounts(reportId: string): Promise<void>;
  calculateConsensusScore(reportId: string): Promise<number>;
  
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

  // Inventory management operations
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  getAllInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItemsByType(itemType: string): Promise<InventoryItem[]>;
  getInventoryItemsByLocation(location: string): Promise<InventoryItem[]>;
  getLowStockItems(): Promise<InventoryItem[]>;
  updateInventoryQuantity(id: string, quantity: number): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: string): Promise<void>;

  // Analytics operations
  createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsEvents(limit?: number): Promise<AnalyticsEvent[]>;
  getAnalyticsEventsByType(eventType: string): Promise<AnalyticsEvent[]>;
  getAnalyticsEventsByDateRange(startDate: Date, endDate: Date): Promise<AnalyticsEvent[]>;

  // User reputation operations
  getUserReputation(userId: string): Promise<UserReputation | undefined>;
  createUserReputation(reputation: InsertUserReputation): Promise<UserReputation>;
  updateUserReputation(userId: string, updates: Partial<InsertUserReputation>): Promise<UserReputation | undefined>;
  incrementReportCount(userId: string, verified: boolean): Promise<void>;
  incrementVerificationsGiven(userId: string): Promise<void>;
  incrementResourcesProvided(userId: string): Promise<void>;
  calculateAndUpdateTrustScore(userId: string): Promise<void>;

  // SOS Alert operations
  createSOSAlert(alert: InsertSOSAlert): Promise<SOSAlert>;
  getSOSAlert(id: string): Promise<SOSAlert | undefined>;
  getAllSOSAlerts(): Promise<SOSAlert[]>;
  getActiveSOSAlerts(): Promise<SOSAlert[]>;
  getSOSAlertsByUser(userId: string): Promise<SOSAlert[]>;
  updateSOSAlertStatus(
    id: string,
    status: "active" | "responding" | "resolved" | "cancelled"
  ): Promise<SOSAlert | undefined>;
  respondToSOSAlert(id: string, responderId: string): Promise<SOSAlert | undefined>;
  resolveSOSAlert(id: string): Promise<SOSAlert | undefined>;
  findNearbyResponders(latitude: string, longitude: string, maxDistance: number): Promise<User[]>;

  // Chat Room operations
  createChatRoom(room: InsertChatRoom): Promise<ChatRoom>;
  getChatRoom(id: string): Promise<ChatRoom | undefined>;
  getUserChatRooms(userId: string): Promise<ChatRoom[]>;
  getChatRoomsByReport(reportId: string): Promise<ChatRoom[]>;
  getChatRoomsBySOS(sosId: string): Promise<ChatRoom[]>;
  
  // Chat Room Member operations
  addChatRoomMember(member: InsertChatRoomMember): Promise<ChatRoomMember>;
  removeChatRoomMember(chatRoomId: string, userId: string): Promise<void>;
  getChatRoomMembers(chatRoomId: string): Promise<ChatRoomMember[]>;
  isChatRoomMember(chatRoomId: string, userId: string): Promise<boolean>;
  updateLastReadAt(chatRoomId: string, userId: string): Promise<void>;

  // Message operations
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(chatRoomId: string, limit?: number): Promise<Message[]>;
  getMessagesSince(chatRoomId: string, sinceDate: Date): Promise<Message[]>;
  deleteMessage(id: string): Promise<void>;

  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotification(id: string): Promise<Notification | undefined>;
  getUserNotifications(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  deleteAllUserNotifications(userId: string): Promise<void>;

  // Notification preferences operations
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  createNotificationPreferences(preferences: InsertNotificationPreferences): Promise<NotificationPreferences>;
  updateNotificationPreferences(userId: string, preferences: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences | undefined>;
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

  async updateUserRole(id: string, role: "citizen" | "volunteer" | "ngo" | "admin" | "government"): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateEmailOTP(id: string, otp: string, expiresAt: Date): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        emailOTP: otp, 
        emailOTPExpiresAt: expiresAt,
        updatedAt: new Date() 
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updatePhoneOTP(id: string, otp: string, expiresAt: Date): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        phoneOTP: otp, 
        phoneOTPExpiresAt: expiresAt,
        updatedAt: new Date() 
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async verifyUserEmail(id: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        emailVerified: new Date(),
        emailOTP: null,
        emailOTPExpiresAt: null,
        updatedAt: new Date() 
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async verifyUserPhone(id: string, phoneNumber: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        phoneNumber,
        phoneVerified: new Date(),
        phoneOTP: null,
        phoneOTPExpiresAt: null,
        updatedAt: new Date() 
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async verifyUserAadhaar(id: string, aadhaarNumber: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        aadhaarNumber,
        aadhaarVerified: new Date(),
        identityVerifiedAt: new Date(),
        updatedAt: new Date() 
      })
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

  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
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

  // Vote operations (community trust rating)
  async createOrUpdateVote(insertVote: InsertReportVote): Promise<ReportVote> {
    const [vote] = await db
      .insert(reportVotes)
      .values(insertVote)
      .onConflictDoUpdate({
        target: [reportVotes.reportId, reportVotes.userId],
        set: {
          voteType: insertVote.voteType,
          updatedAt: new Date(),
        },
      })
      .returning();
    return vote;
  }

  async getUserVoteForReport(
    userId: string,
    reportId: string
  ): Promise<ReportVote | undefined> {
    const [vote] = await db
      .select()
      .from(reportVotes)
      .where(
        and(
          eq(reportVotes.userId, userId),
          eq(reportVotes.reportId, reportId)
        )
      );
    return vote;
  }

  async getVoteCountsForReport(reportId: string): Promise<{ upvotes: number; downvotes: number }> {
    const votes = await db
      .select()
      .from(reportVotes)
      .where(eq(reportVotes.reportId, reportId));
    
    const upvotes = votes.filter(v => v.voteType === "upvote").length;
    const downvotes = votes.filter(v => v.voteType === "downvote").length;
    
    return { upvotes, downvotes };
  }

  async deleteVote(userId: string, reportId: string): Promise<void> {
    await db
      .delete(reportVotes)
      .where(
        and(
          eq(reportVotes.userId, userId),
          eq(reportVotes.reportId, reportId)
        )
      );
  }

  async updateReportVoteCounts(reportId: string): Promise<void> {
    const { upvotes, downvotes } = await this.getVoteCountsForReport(reportId);
    const consensusScore = await this.calculateConsensusScore(reportId);
    
    await db
      .update(disasterReports)
      .set({
        upvotes,
        downvotes,
        consensusScore,
        updatedAt: new Date(),
      })
      .where(eq(disasterReports.id, reportId));
  }

  async calculateConsensusScore(reportId: string): Promise<number> {
    const report = await this.getDisasterReport(reportId);
    if (!report) return 0;
    
    const { upvotes, downvotes } = await this.getVoteCountsForReport(reportId);
    const verificationCount = report.verificationCount;
    const aiScore = report.aiValidationScore || 0;
    const isConfirmed = report.confirmedBy ? 1 : 0;
    
    const netVotes = upvotes - downvotes;
    const voteScore = Math.max(-100, Math.min(100, netVotes * 5));
    const verificationScore = Math.min(50, verificationCount * 10);
    const aiScoreNormalized = (aiScore / 100) * 20;
    const confirmationBonus = isConfirmed * 30;
    
    const totalScore = voteScore + verificationScore + aiScoreNormalized + confirmationBonus;
    
    return Math.max(0, Math.min(100, Math.round(totalScore)));
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

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const [inventoryItem] = await db
      .insert(inventoryItems)
      .values(item)
      .returning();
    return inventoryItem;
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const [item] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id));
    return item;
  }

  async getAllInventoryItems(): Promise<InventoryItem[]> {
    return db
      .select()
      .from(inventoryItems)
      .orderBy(desc(inventoryItems.createdAt));
  }

  async getInventoryItemsByType(itemType: string): Promise<InventoryItem[]> {
    return db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.itemType, itemType as any))
      .orderBy(desc(inventoryItems.createdAt));
  }

  async getInventoryItemsByLocation(location: string): Promise<InventoryItem[]> {
    return db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.location, location))
      .orderBy(desc(inventoryItems.createdAt));
  }

  async getLowStockItems(): Promise<InventoryItem[]> {
    return db
      .select()
      .from(inventoryItems)
      .where(sql`${inventoryItems.quantity} <= ${inventoryItems.minimumThreshold}`)
      .orderBy(desc(inventoryItems.createdAt));
  }

  async updateInventoryQuantity(id: string, quantity: number): Promise<InventoryItem | undefined> {
    const [item] = await db
      .update(inventoryItems)
      .set({
        quantity,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, id))
      .returning();
    return item;
  }

  async deleteInventoryItem(id: string): Promise<void> {
    await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
  }

  async createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const [analyticsEvent] = await db
      .insert(analyticsEvents)
      .values(event)
      .returning();
    return analyticsEvent;
  }

  async getAnalyticsEvents(limit: number = 1000): Promise<AnalyticsEvent[]> {
    return db
      .select()
      .from(analyticsEvents)
      .orderBy(desc(analyticsEvents.createdAt))
      .limit(limit);
  }

  async getAnalyticsEventsByType(eventType: string): Promise<AnalyticsEvent[]> {
    return db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventType, eventType as any))
      .orderBy(desc(analyticsEvents.createdAt));
  }

  async getAnalyticsEventsByDateRange(startDate: Date, endDate: Date): Promise<AnalyticsEvent[]> {
    return db
      .select()
      .from(analyticsEvents)
      .where(
        and(
          sql`${analyticsEvents.createdAt} >= ${startDate}`,
          sql`${analyticsEvents.createdAt} <= ${endDate}`
        )
      )
      .orderBy(desc(analyticsEvents.createdAt));
  }

  async getUserReputation(userId: string): Promise<UserReputation | undefined> {
    const [reputation] = await db
      .select()
      .from(userReputation)
      .where(eq(userReputation.userId, userId));
    return reputation;
  }

  async createUserReputation(reputation: InsertUserReputation): Promise<UserReputation> {
    const [userRep] = await db
      .insert(userReputation)
      .values(reputation)
      .returning();
    return userRep;
  }

  async updateUserReputation(userId: string, updates: Partial<InsertUserReputation>): Promise<UserReputation | undefined> {
    const [reputation] = await db
      .update(userReputation)
      .set({
        ...updates,
        lastUpdated: new Date(),
      })
      .where(eq(userReputation.userId, userId))
      .returning();
    return reputation;
  }

  async incrementReportCount(userId: string, verified: boolean): Promise<void> {
    let rep = await this.getUserReputation(userId);
    
    if (!rep) {
      rep = await this.createUserReputation({ userId });
    }

    await this.updateUserReputation(userId, {
      totalReports: rep.totalReports + 1,
      verifiedReports: verified ? rep.verifiedReports + 1 : rep.verifiedReports,
    });

    await this.calculateAndUpdateTrustScore(userId);
  }

  async incrementVerificationsGiven(userId: string): Promise<void> {
    let rep = await this.getUserReputation(userId);
    
    if (!rep) {
      rep = await this.createUserReputation({ userId });
    }

    await this.updateUserReputation(userId, {
      verificationsGiven: rep.verificationsGiven + 1,
    });

    await this.calculateAndUpdateTrustScore(userId);
  }

  async incrementResourcesProvided(userId: string): Promise<void> {
    let rep = await this.getUserReputation(userId);
    
    if (!rep) {
      rep = await this.createUserReputation({ userId });
    }

    await this.updateUserReputation(userId, {
      resourcesProvided: rep.resourcesProvided + 1,
    });

    await this.calculateAndUpdateTrustScore(userId);
  }

  async calculateAndUpdateTrustScore(userId: string): Promise<void> {
    const rep = await this.getUserReputation(userId);
    
    if (!rep) return;

    let score = 50;

    const verificationRate = rep.totalReports > 0 
      ? (rep.verifiedReports / rep.totalReports) * 100 
      : 50;
    score += (verificationRate - 50) * 0.3;

    if (rep.totalReports > 0) {
      const falseReportRate = (rep.falseReports / rep.totalReports) * 100;
      score -= falseReportRate * 0.5;
    }

    score += Math.min(rep.verificationsGiven * 0.5, 15);

    const upvoteRatio = (rep.upvotesReceived + rep.downvotesReceived) > 0
      ? (rep.upvotesReceived / (rep.upvotesReceived + rep.downvotesReceived)) * 100
      : 50;
    score += (upvoteRatio - 50) * 0.2;

    score += Math.min(rep.resourcesProvided * 1, 20);

    score = Math.max(0, Math.min(100, Math.round(score)));

    await this.updateUserReputation(userId, {
      trustScore: score,
    });
  }

  // SOS Alert operations
  async createSOSAlert(alert: InsertSOSAlert): Promise<SOSAlert> {
    const [sosAlert] = await db.insert(sosAlerts).values(alert).returning();
    return sosAlert;
  }

  async getSOSAlert(id: string): Promise<SOSAlert | undefined> {
    const [sosAlert] = await db.select().from(sosAlerts).where(eq(sosAlerts.id, id));
    return sosAlert;
  }

  async getAllSOSAlerts(): Promise<SOSAlert[]> {
    return db.select().from(sosAlerts).orderBy(desc(sosAlerts.createdAt));
  }

  async getActiveSOSAlerts(): Promise<SOSAlert[]> {
    return db
      .select()
      .from(sosAlerts)
      .where(eq(sosAlerts.status, "active"))
      .orderBy(desc(sosAlerts.createdAt));
  }

  async getSOSAlertsByUser(userId: string): Promise<SOSAlert[]> {
    return db
      .select()
      .from(sosAlerts)
      .where(eq(sosAlerts.userId, userId))
      .orderBy(desc(sosAlerts.createdAt));
  }

  async updateSOSAlertStatus(
    id: string,
    status: "active" | "responding" | "resolved" | "cancelled"
  ): Promise<SOSAlert | undefined> {
    const [sosAlert] = await db
      .update(sosAlerts)
      .set({ status, updatedAt: new Date() })
      .where(eq(sosAlerts.id, id))
      .returning();
    return sosAlert;
  }

  async respondToSOSAlert(id: string, responderId: string): Promise<SOSAlert | undefined> {
    const [sosAlert] = await db
      .update(sosAlerts)
      .set({
        status: "responding",
        respondedBy: responderId,
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sosAlerts.id, id))
      .returning();
    return sosAlert;
  }

  async resolveSOSAlert(id: string): Promise<SOSAlert | undefined> {
    const [sosAlert] = await db
      .update(sosAlerts)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sosAlerts.id, id))
      .returning();
    return sosAlert;
  }

  async findNearbyResponders(latitude: string, longitude: string, maxDistance: number): Promise<User[]> {
    const responders = await db
      .select()
      .from(users)
      .where(and(
        eq(users.role, "volunteer"),
        sql`${users.id} IS NOT NULL`
      ));
    return responders.slice(0, 10);
  }

  // Chat Room operations
  async createChatRoom(room: InsertChatRoom): Promise<ChatRoom> {
    const [chatRoom] = await db.insert(chatRooms).values(room).returning();
    return chatRoom;
  }

  async getChatRoom(id: string): Promise<ChatRoom | undefined> {
    const [chatRoom] = await db.select().from(chatRooms).where(eq(chatRooms.id, id));
    return chatRoom;
  }

  async getUserChatRooms(userId: string): Promise<ChatRoom[]> {
    const userRooms = await db
      .select({ chatRoomId: chatRoomMembers.chatRoomId })
      .from(chatRoomMembers)
      .where(eq(chatRoomMembers.userId, userId));
    
    if (userRooms.length === 0) {
      return [];
    }

    const roomIds = userRooms.map(r => r.chatRoomId);
    return db
      .select()
      .from(chatRooms)
      .where(sql`${chatRooms.id} IN ${roomIds}`)
      .orderBy(desc(chatRooms.updatedAt));
  }

  async getChatRoomsByReport(reportId: string): Promise<ChatRoom[]> {
    return db
      .select()
      .from(chatRooms)
      .where(eq(chatRooms.relatedReportId, reportId))
      .orderBy(desc(chatRooms.createdAt));
  }

  async getChatRoomsBySOS(sosId: string): Promise<ChatRoom[]> {
    return db
      .select()
      .from(chatRooms)
      .where(eq(chatRooms.relatedSOSId, sosId))
      .orderBy(desc(chatRooms.createdAt));
  }

  // Chat Room Member operations
  async addChatRoomMember(member: InsertChatRoomMember): Promise<ChatRoomMember> {
    const [chatMember] = await db.insert(chatRoomMembers).values(member).returning();
    return chatMember;
  }

  async removeChatRoomMember(chatRoomId: string, userId: string): Promise<void> {
    await db
      .delete(chatRoomMembers)
      .where(
        and(
          eq(chatRoomMembers.chatRoomId, chatRoomId),
          eq(chatRoomMembers.userId, userId)
        )
      );
  }

  async getChatRoomMembers(chatRoomId: string): Promise<ChatRoomMember[]> {
    return db
      .select()
      .from(chatRoomMembers)
      .where(eq(chatRoomMembers.chatRoomId, chatRoomId));
  }

  async isChatRoomMember(chatRoomId: string, userId: string): Promise<boolean> {
    const [member] = await db
      .select()
      .from(chatRoomMembers)
      .where(
        and(
          eq(chatRoomMembers.chatRoomId, chatRoomId),
          eq(chatRoomMembers.userId, userId)
        )
      );
    return !!member;
  }

  async updateLastReadAt(chatRoomId: string, userId: string): Promise<void> {
    await db
      .update(chatRoomMembers)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(chatRoomMembers.chatRoomId, chatRoomId),
          eq(chatRoomMembers.userId, userId)
        )
      );
  }

  // Message operations
  async createMessage(message: InsertMessage): Promise<Message> {
    let messageData: any = { ...message };
    
    if (isEncryptionEnabled() && message.messageType !== "system") {
      try {
        const encrypted = encryptMessage(message.content);
        messageData = {
          ...message,
          content: encrypted.encrypted,
          encryptionIv: encrypted.iv,
          encryptionTag: encrypted.tag,
          isEncrypted: true,
        };
      } catch (error) {
        console.error("Encryption failed, storing message unencrypted:", error);
        messageData = {
          ...message,
          isEncrypted: false,
        };
      }
    } else {
      messageData = {
        ...message,
        isEncrypted: false,
      };
    }
    
    const [msg] = await db.insert(messages).values(messageData).returning();
    return msg;
  }

  async getMessages(chatRoomId: string, limit: number = 100): Promise<Message[]> {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.chatRoomId, chatRoomId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    
    return msgs.map((msg) => {
      if (msg.isEncrypted && msg.encryptionIv && msg.encryptionTag) {
        try {
          return {
            ...msg,
            content: decryptMessage({
              encrypted: msg.content,
              iv: msg.encryptionIv,
              tag: msg.encryptionTag,
            }),
          };
        } catch (error) {
          console.error("Decryption failed for message:", msg.id, error);
          return {
            ...msg,
            content: "[Encrypted message - decryption failed]",
          };
        }
      }
      return msg;
    });
  }

  async getMessagesSince(chatRoomId: string, sinceDate: Date): Promise<Message[]> {
    const msgs = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.chatRoomId, chatRoomId),
          sql`${messages.createdAt} > ${sinceDate}`
        )
      )
      .orderBy(messages.createdAt);
    
    return msgs.map((msg) => {
      if (msg.isEncrypted && msg.encryptionIv && msg.encryptionTag) {
        try {
          return {
            ...msg,
            content: decryptMessage({
              encrypted: msg.content,
              iv: msg.encryptionIv,
              tag: msg.encryptionTag,
            }),
          };
        } catch (error) {
          console.error("Decryption failed for message:", msg.id, error);
          return {
            ...msg,
            content: "[Encrypted message - decryption failed]",
          };
        }
      }
      return msg;
    });
  }

  async deleteMessage(id: string): Promise<void> {
    await db.delete(messages).where(eq(messages.id, id));
  }

  // Notification operations
  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values(insertNotification)
      .returning();
    return notification;
  }

  async getNotification(id: string): Promise<Notification | undefined> {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id));
    return notification;
  }

  async getUserNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      )
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );
    return result.length;
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(notifications.id, id))
      .returning();
    return notification;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  async deleteAllUserNotifications(userId: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.userId, userId));
  }

  // Notification preferences operations
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return prefs;
  }

  async createNotificationPreferences(prefs: InsertNotificationPreferences): Promise<NotificationPreferences> {
    const [preferences] = await db
      .insert(notificationPreferences)
      .values(prefs)
      .returning();
    return preferences;
  }

  async updateNotificationPreferences(
    userId: string,
    updates: Partial<InsertNotificationPreferences>
  ): Promise<NotificationPreferences | undefined> {
    const [prefs] = await db
      .update(notificationPreferences)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.userId, userId))
      .returning();
    return prefs;
  }
}

export const storage = new DatabaseStorage();
