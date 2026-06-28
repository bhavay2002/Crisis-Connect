import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  pgEnum,
  index,
  uniqueIndex,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - Required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User role enum
export const userRoleEnum = pgEnum("user_role", [
  "citizen",
  "volunteer",
  "ngo",
  "admin",
  "government",
  "authority",
  "super_admin",
]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").default("citizen"),
  phoneNumber: varchar("phone_number"),
  phoneVerified: timestamp("phone_verified"),
  phoneOTP: varchar("phone_otp"),
  phoneOTPExpiresAt: timestamp("phone_otp_expires_at"),
  emailVerified: timestamp("email_verified"),
  emailOTP: varchar("email_otp"),
  emailOTPExpiresAt: timestamp("email_otp_expires_at"),
  aadhaarNumber: varchar("aadhaar_number", { length: 12 }),
  aadhaarVerified: timestamp("aadhaar_verified"),
  identityVerifiedAt: timestamp("identity_verified_at"),
  refreshToken: text("refresh_token"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Disaster report types and severity enums
export const disasterTypeEnum = pgEnum("disaster_type", [
  "fire",
  "flood",
  "earthquake",
  "storm",
  "road_accident",
  "epidemic",
  "landslide",
  "gas_leak",
  "building_collapse",
  "chemical_spill",
  "power_outage",
  "water_contamination",
  "other",
]);

export const severityEnum = pgEnum("severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const statusEnum = pgEnum("status", [
  "reported",
  "verified",
  "responding",
  "resolved",
]);

export const flagTypeEnum = pgEnum("flag_type", [
  "false_report",
  "duplicate",
  "spam",
]);

// Disaster reports table
export const disasterReports = pgTable("disaster_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: disasterTypeEnum("type").notNull(),
  severity: severityEnum("severity").notNull(),
  status: statusEnum("status").notNull().default("reported"),
  location: text("location").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  mediaUrls: text("media_urls").array().default(sql`ARRAY[]::text[]`),
  aiValidationScore: integer("ai_validation_score"),
  aiValidationNotes: text("ai_validation_notes"),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  verificationCount: integer("verification_count").notNull().default(0),
  upvotes: integer("upvotes").notNull().default(0),
  downvotes: integer("downvotes").notNull().default(0),
  consensusScore: integer("consensus_score").notNull().default(0),
  confirmedBy: varchar("confirmed_by").references(() => users.id),
  confirmedAt: timestamp("confirmed_at"),
  flagType: flagTypeEnum("flag_type"),
  flaggedBy: varchar("flagged_by").references(() => users.id),
  flaggedAt: timestamp("flagged_at"),
  adminNotes: text("admin_notes"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  assignedAt: timestamp("assigned_at"),
  priorityScore: integer("priority_score"),
  fakeDetectionScore: integer("fake_detection_score"),
  fakeDetectionFlags: text("fake_detection_flags").array().default(sql`ARRAY[]::text[]`),
  imageMetadata: jsonb("image_metadata"),
  textAnalysisResults: jsonb("text_analysis_results"),
  similarReportIds: text("similar_report_ids").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_disaster_reports_user_id").on(table.userId),
  index("idx_disaster_reports_status").on(table.status),
  index("idx_disaster_reports_type").on(table.type),
  index("idx_disaster_reports_severity").on(table.severity),
  index("idx_disaster_reports_created_at").on(table.createdAt),
  index("idx_disaster_reports_status_created_at").on(table.status, table.createdAt),
  index("idx_disaster_reports_type_severity").on(table.type, table.severity),
]);

export const insertDisasterReportSchema = createInsertSchema(disasterReports).omit({
  id: true,
  verificationCount: true,
  upvotes: true,
  downvotes: true,
  consensusScore: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  aiValidationScore: true,
  aiValidationNotes: true,
  flagType: true,
  flaggedBy: true,
  flaggedAt: true,
  adminNotes: true,
  assignedTo: true,
  assignedAt: true,
  priorityScore: true,
  confirmedBy: true,
  confirmedAt: true,
  fakeDetectionScore: true,
  fakeDetectionFlags: true,
  imageMetadata: true,
  textAnalysisResults: true,
  similarReportIds: true,
});

export type InsertDisasterReport = z.infer<typeof insertDisasterReportSchema>;
export type DisasterReport = typeof disasterReports.$inferSelect;

// Verifications table - tracks which users verified which reports
export const verifications = pgTable("verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id")
    .notNull()
    .references(() => disasterReports.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_verifications_report_id").on(table.reportId),
  index("idx_verifications_user_id").on(table.userId),
  uniqueIndex("unique_user_report_verification").on(table.reportId, table.userId),
]);

export const insertVerificationSchema = createInsertSchema(verifications).omit({
  id: true,
  createdAt: true,
});

export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type Verification = typeof verifications.$inferSelect;

// Report votes enum
export const voteTypeEnum = pgEnum("vote_type", [
  "upvote",
  "downvote",
]);

// Report votes table - tracks community upvotes/downvotes for trust rating
export const reportVotes = pgTable("report_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id")
    .notNull()
    .references(() => disasterReports.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  voteType: voteTypeEnum("vote_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_report_votes_report_id").on(table.reportId),
  index("idx_report_votes_user_id").on(table.userId),
  uniqueIndex("unique_user_report_vote").on(table.reportId, table.userId),
]);

export const insertReportVoteSchema = createInsertSchema(reportVotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReportVote = z.infer<typeof insertReportVoteSchema>;
export type ReportVote = typeof reportVotes.$inferSelect;

// Resource request type and urgency enums
export const resourceTypeEnum = pgEnum("resource_type", [
  "food",
  "water",
  "shelter",
  "medical",
  "clothing",
  "blankets",
  "other",
]);

export const urgencyEnum = pgEnum("urgency", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "in_progress",
  "fulfilled",
  "cancelled",
]);

// Resource requests table
export const resourceRequests = pgTable("resource_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resourceType: resourceTypeEnum("resource_type").notNull(),
  quantity: integer("quantity").notNull(),
  urgency: urgencyEnum("urgency").notNull(),
  status: requestStatusEnum("status").notNull().default("pending"),
  description: text("description"),
  location: text("location").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  contactInfo: text("contact_info"),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  disasterReportId: varchar("disaster_report_id").references(() => disasterReports.id),
  fulfilledBy: varchar("fulfilled_by").references(() => users.id),
  fulfilledAt: timestamp("fulfilled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_resource_requests_user_id").on(table.userId),
  index("idx_resource_requests_status").on(table.status),
  index("idx_resource_requests_urgency").on(table.urgency),
  index("idx_resource_requests_created_at").on(table.createdAt),
  index("idx_resource_requests_disaster_report_id").on(table.disasterReportId),
]);

export const insertResourceRequestSchema = createInsertSchema(resourceRequests).omit({
  id: true,
  status: true,
  fulfilledBy: true,
  fulfilledAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertResourceRequest = z.infer<typeof insertResourceRequestSchema>;
export type ResourceRequest = typeof resourceRequests.$inferSelect;

// Aid offer status enum
export const aidOfferStatusEnum = pgEnum("aid_offer_status", [
  "available",
  "committed",
  "delivered",
  "cancelled",
]);

// Aid offers table - Volunteers can list available resources
export const aidOffers = pgTable("aid_offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resourceType: resourceTypeEnum("resource_type").notNull(),
  quantity: integer("quantity").notNull(),
  status: aidOfferStatusEnum("status").notNull().default("available"),
  description: text("description"),
  location: text("location").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  contactInfo: text("contact_info"),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  matchedRequestId: varchar("matched_request_id").references(() => resourceRequests.id),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAidOfferSchema = createInsertSchema(aidOffers).omit({
  id: true,
  status: true,
  matchedRequestId: true,
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAidOffer = z.infer<typeof insertAidOfferSchema>;
export type AidOffer = typeof aidOffers.$inferSelect;

export const inventoryItemTypeEnum = pgEnum("inventory_item_type", [
  "shelter",
  "food",
  "water",
  "medical_supplies",
  "clothing",
  "blankets",
  "equipment",
  "other",
]);

export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  itemType: inventoryItemTypeEnum("item_type").notNull(),
  quantity: integer("quantity").notNull(),
  unit: varchar("unit").notNull(),
  location: text("location").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  expiryDate: timestamp("expiry_date"),
  minimumThreshold: integer("minimum_threshold").default(10),
  description: text("description"),
  managedBy: varchar("managed_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;

export const analyticsEventTypeEnum = pgEnum("analytics_event_type", [
  "report_submitted",
  "report_verified",
  "report_resolved",
  "resource_requested",
  "resource_fulfilled",
  "aid_offered",
  "aid_delivered",
  "user_registered",
]);

export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: analyticsEventTypeEnum("event_type").notNull(),
  userId: varchar("user_id").references(() => users.id),
  relatedEntityId: varchar("related_entity_id"),
  relatedEntityType: varchar("related_entity_type"),
  metadata: jsonb("metadata"),
  location: text("location"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  responseTime: integer("response_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

export const userReputation = pgTable("user_reputation", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => users.id),
  trustScore: integer("trust_score").notNull().default(50),
  totalReports: integer("total_reports").notNull().default(0),
  verifiedReports: integer("verified_reports").notNull().default(0),
  falseReports: integer("false_reports").notNull().default(0),
  verificationsGiven: integer("verifications_given").notNull().default(0),
  upvotesReceived: integer("upvotes_received").notNull().default(0),
  downvotesReceived: integer("downvotes_received").notNull().default(0),
  resourcesProvided: integer("resources_provided").notNull().default(0),
  resourcesFulfilled: integer("resources_fulfilled").notNull().default(0),
  responseTimeAvg: integer("response_time_avg"),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const insertUserReputationSchema = createInsertSchema(userReputation).omit({
  lastUpdated: true,
});

export type InsertUserReputation = z.infer<typeof insertUserReputationSchema>;
export type UserReputation = typeof userReputation.$inferSelect;

// SOS Alerts
export const sosStatusEnum = pgEnum("sos_status", [
  "active",
  "responding",
  "resolved",
  "cancelled",
]);

export const sosAlerts = pgTable("sos_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  emergencyType: disasterTypeEnum("emergency_type").notNull().default("other"),
  severity: severityEnum("severity").notNull().default("high"),
  status: sosStatusEnum("status").notNull().default("active"),
  location: text("location").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  description: text("description"),
  contactNumber: varchar("contact_number"),
  respondedBy: varchar("responded_by").references(() => users.id),
  respondedAt: timestamp("responded_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSOSAlertSchema = createInsertSchema(sosAlerts).omit({
  id: true,
  status: true,
  respondedBy: true,
  respondedAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSOSAlert = z.infer<typeof insertSOSAlertSchema>;
export type SOSAlert = typeof sosAlerts.$inferSelect;

// Chat Rooms
export const chatRoomTypeEnum = pgEnum("chat_room_type", [
  "direct",
  "group",
  "report",
]);

export const chatRooms = pgTable("chat_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  type: chatRoomTypeEnum("type").notNull(),
  relatedReportId: varchar("related_report_id").references(() => disasterReports.id),
  relatedSOSId: varchar("related_sos_id").references(() => sosAlerts.id),
  createdBy: varchar("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertChatRoomSchema = createInsertSchema(chatRooms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChatRoom = z.infer<typeof insertChatRoomSchema>;
export type ChatRoom = typeof chatRooms.$inferSelect;

// Chat Room Members
export const chatRoomMembers = pgTable("chat_room_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatRoomId: varchar("chat_room_id")
    .notNull()
    .references(() => chatRooms.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role").default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  lastReadAt: timestamp("last_read_at"),
});

export const insertChatRoomMemberSchema = createInsertSchema(chatRoomMembers).omit({
  id: true,
  joinedAt: true,
});

export type InsertChatRoomMember = z.infer<typeof insertChatRoomMemberSchema>;
export type ChatRoomMember = typeof chatRoomMembers.$inferSelect;

// Messages
export const messageTypeEnum = pgEnum("message_type", [
  "text",
  "ai_assistant",
  "system",
  "location",
  "media",
]);

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatRoomId: varchar("chat_room_id")
    .notNull()
    .references(() => chatRooms.id),
  senderId: varchar("sender_id").references(() => users.id),
  content: text("content").notNull(),
  messageType: messageTypeEnum("message_type").notNull().default("text"),
  metadata: jsonb("metadata"),
  encryptionIv: varchar("encryption_iv", { length: 32 }),
  encryptionTag: varchar("encryption_tag", { length: 32 }),
  isEncrypted: boolean("is_encrypted").default(false).notNull(),
  status: text("status").notNull().default("sent"),
  isPinned: boolean("is_pinned").default(false).notNull(),
  isPriority: boolean("is_priority").default(false).notNull(),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  encryptionIv: true,
  encryptionTag: true,
  isEncrypted: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Notification types and priority enums
export const notificationTypeEnum = pgEnum("notification_type", [
  "disaster_nearby",
  "disaster_verified",
  "disaster_resolved",
  "sos_alert",
  "resource_request",
  "resource_fulfilled",
  "aid_matched",
  "report_assigned",
  "report_confirmed",
  "low_inventory",
  "system_alert",
]);

export const notificationPriorityEnum = pgEnum("notification_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  type: notificationTypeEnum("type").notNull(),
  priority: notificationPriorityEnum("priority").notNull().default("medium"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  actionUrl: text("action_url"),
  relatedEntityId: varchar("related_entity_id"),
  relatedEntityType: varchar("related_entity_type"),
  metadata: jsonb("metadata"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  isRead: true,
  readAt: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Notification preferences table
export const notificationPreferences = pgTable("notification_preferences", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => users.id),
  disasterNearby: boolean("disaster_nearby").notNull().default(true),
  disasterVerified: boolean("disaster_verified").notNull().default(true),
  disasterResolved: boolean("disaster_resolved").notNull().default(true),
  sosAlert: boolean("sos_alert").notNull().default(true),
  resourceRequest: boolean("resource_request").notNull().default(true),
  resourceFulfilled: boolean("resource_fulfilled").notNull().default(true),
  aidMatched: boolean("aid_matched").notNull().default(true),
  reportAssigned: boolean("report_assigned").notNull().default(true),
  reportConfirmed: boolean("report_confirmed").notNull().default(true),
  lowInventory: boolean("low_inventory").notNull().default(true),
  systemAlert: boolean("system_alert").notNull().default(true),
  notificationRadius: integer("notification_radius").notNull().default(50),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  updatedAt: true,
});

export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;

// Risk level enum for predictions
export const riskLevelEnum = pgEnum("risk_level", [
  "very_low",
  "low",
  "medium",
  "high",
  "very_high",
]);

// Disaster predictions table
export const disasterPredictions = pgTable("disaster_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  disasterType: disasterTypeEnum("disaster_type").notNull(),
  predictedArea: text("predicted_area").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  radius: integer("radius").notNull(),
  riskLevel: riskLevelEnum("risk_level").notNull(),
  confidence: integer("confidence").notNull(),
  weatherData: jsonb("weather_data"),
  seismicData: jsonb("seismic_data"),
  historicalPatterns: jsonb("historical_patterns"),
  predictionFactors: text("prediction_factors").array().default(sql`ARRAY[]::text[]`),
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  affectedPopulation: integer("affected_population"),
  modelVersion: varchar("model_version").default("1.0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDisasterPredictionSchema = createInsertSchema(disasterPredictions).omit({
  id: true,
  createdAt: true,
});

export type InsertDisasterPrediction = z.infer<typeof insertDisasterPredictionSchema>;
export type DisasterPrediction = typeof disasterPredictions.$inferSelect;

// ─── Production Elite: Incident Aggregation ───────────────────────────────────

export const incidentStatusEnum = pgEnum("incident_status", [
  "active",
  "merged",
  "resolved",
  "closed",
]);

export const incidents = pgTable("incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  disasterType: disasterTypeEnum("disaster_type").notNull(),
  severity: severityEnum("severity").notNull(),
  status: incidentStatusEnum("status").notNull().default("active"),
  centroidLat: text("centroid_lat"),
  centroidLon: text("centroid_lon"),
  location: text("location").notNull(),
  reportCount: integer("report_count").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_incidents_status").on(table.status),
  index("idx_incidents_type").on(table.disasterType),
  index("idx_incidents_created_at").on(table.createdAt),
]);

export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = typeof incidents.$inferInsert;

export const incidentReports = pgTable("incident_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentId: varchar("incident_id")
    .notNull()
    .references(() => incidents.id),
  reportId: varchar("report_id")
    .notNull()
    .references(() => disasterReports.id),
  mergedAt: timestamp("merged_at").defaultNow().notNull(),
}, (table) => [
  index("idx_incident_reports_incident_id").on(table.incidentId),
  index("idx_incident_reports_report_id").on(table.reportId),
]);

export type IncidentReport = typeof incidentReports.$inferSelect;

// ─── Device Fingerprinting (Spec §6.2) ───────────────────────────────────────

export const deviceFingerprints = pgTable("device_fingerprints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  userAgent: text("user_agent"),
  fingerprintHash: varchar("fingerprint_hash", { length: 64 }).notNull(),
  riskScore: integer("risk_score").default(0).notNull(),
  requestCount: integer("request_count").default(1).notNull(),
  isFlagged: boolean("is_flagged").default(false).notNull(),
  flagReason: text("flag_reason"),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
}, (table) => [
  index("idx_device_fp_user_id").on(table.userId),
  index("idx_device_fp_hash").on(table.fingerprintHash),
  index("idx_device_fp_ip").on(table.ipAddress),
]);

export type DeviceFingerprint = typeof deviceFingerprints.$inferSelect;

// ─── §9: Organizations & Multi-Tenancy ───────────────────────────────────────

export const orgTypeEnum = pgEnum("org_type", ["ngo", "government", "private", "military", "un_agency"]);

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: orgTypeEnum("type").notNull().default("ngo"),
  description: text("description"),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  website: varchar("website"),
  region: varchar("region"),
  isVerified: boolean("is_verified").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_orgs_type").on(table.type),
  index("idx_orgs_region").on(table.region),
]);

export const orgMemberRoleEnum = pgEnum("org_member_role", ["owner", "admin", "member", "observer"]);

export const organizationMembers = pgTable("organization_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: orgMemberRoleEnum("role").default("member").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_org_member_unique").on(table.orgId, table.userId),
  index("idx_org_member_org").on(table.orgId),
  index("idx_org_member_user").on(table.userId),
]);

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;

// ─── §12: GDPR / Compliance ───────────────────────────────────────────────────

export const consentTypeEnum = pgEnum("consent_type", [
  "data_processing",
  "location_tracking",
  "analytics",
  "marketing",
  "third_party_sharing",
]);

export const userConsents = pgTable("user_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  consentType: consentTypeEnum("consent_type").notNull(),
  granted: boolean("granted").notNull(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  version: varchar("version").default("1.0").notNull(),
}, (table) => [
  index("idx_consents_user").on(table.userId),
  index("idx_consents_type").on(table.consentType),
]);

export type UserConsent = typeof userConsents.$inferSelect;
export type InsertUserConsent = typeof userConsents.$inferInsert;

// ─── Production Elite: State Transition Audit Log ────────────────────────────

export const incidentLogs = pgTable("incident_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").notNull(),
  entityType: varchar("entity_type").notNull().default("report"),
  fromState: text("from_state").notNull(),
  toState: text("to_state").notNull(),
  triggeredBy: varchar("triggered_by"),
  reason: text("reason"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_incident_logs_entity_id").on(table.entityId),
  index("idx_incident_logs_timestamp").on(table.timestamp),
]);

// ─── §13: Integration Ecosystem ───────────────────────────────────────────────

export const weatherAlertLevelEnum = pgEnum("weather_alert_level", ["none", "watch", "warning", "emergency"]);

export const weatherData = pgTable("weather_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  region: varchar("region").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  temperature: text("temperature"),
  rainfall: text("rainfall"),
  windSpeed: text("wind_speed"),
  humidity: text("humidity"),
  weatherCode: integer("weather_code"),
  alertLevel: weatherAlertLevelEnum("alert_level").default("none").notNull(),
  riskScore: integer("risk_score").default(0).notNull(),
  rawData: jsonb("raw_data"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
}, (table) => [
  index("idx_weather_region").on(table.region),
  index("idx_weather_fetched").on(table.fetchedAt),
]);

export type WeatherData = typeof weatherData.$inferSelect;
export type InsertWeatherData = typeof weatherData.$inferInsert;

// ─── §14: Developer Platform ──────────────────────────────────────────────────

export const apiKeyTierEnum = pgEnum("api_key_tier", ["free", "paid", "enterprise"]);

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  keyHash: varchar("key_hash").notNull(),
  keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
  tier: apiKeyTierEnum("tier").default("free").notNull(),
  dailyLimit: integer("daily_limit").default(100).notNull(),
  requestCount: integer("request_count").default(0).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  uniqueIndex("idx_api_keys_hash").on(table.keyHash),
  index("idx_api_keys_user").on(table.userId),
]);

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

export const webhookEventEnum = pgEnum("webhook_event", [
  "crisis.created", "crisis.updated", "crisis.resolved",
  "sos.created", "sos.resolved", "alert.broadcast",
]);

export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  events: text("events").array().notNull(),
  secret: varchar("secret").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  failureCount: integer("failure_count").default(0).notNull(),
  lastDeliveredAt: timestamp("last_delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_webhooks_user").on(table.userId),
]);

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull().references(() => webhookSubscriptions.id, { onDelete: "cascade" }),
  event: varchar("event").notNull(),
  payload: jsonb("payload").notNull(),
  statusCode: integer("status_code"),
  attempts: integer("attempts").default(1).notNull(),
  success: boolean("success").default(false).notNull(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
}, (table) => [
  index("idx_webhook_deliveries_sub").on(table.subscriptionId),
]);

export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;

// ─── §17: Advanced Differentiators ────────────────────────────────────────────

// §17.2 Simulation Engine
export const simulationStatusEnum = pgEnum("simulation_status", ["pending", "running", "completed", "failed"]);
export const simulationScenarioEnum = pgEnum("simulation_scenario", ["flood", "earthquake", "storm", "mass_accident", "epidemic", "coordinated_attack", "infrastructure_failure"]);

export const simulationRuns = pgTable("simulation_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scenario: simulationScenarioEnum("scenario").notNull(),
  location: varchar("location").notNull(),
  intensity: varchar("intensity").notNull().default("medium"),
  eventCount: integer("event_count").notNull().default(0),
  status: simulationStatusEnum("status").default("pending").notNull(),
  metricsData: jsonb("metrics_data"),
  injectedEventIds: text("injected_event_ids").array().default(sql`ARRAY[]::text[]`),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  initiatedBy: varchar("initiated_by").references(() => users.id),
}, (table) => [
  index("idx_simulation_runs_status").on(table.status),
]);

export type SimulationRun = typeof simulationRuns.$inferSelect;

// §17.3 Digital Twin
export const cityNodeTypeEnum = pgEnum("city_node_type", ["hospital", "fire_station", "police", "shelter", "road_junction", "bridge", "zone", "landmark"]);

export const cityNodes = pgTable("city_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cityId: varchar("city_id").notNull().default("default"),
  name: varchar("name").notNull(),
  type: cityNodeTypeEnum("type").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  riskScore: integer("risk_score").default(0).notNull(),
  capacity: integer("capacity"),
  metadata: jsonb("metadata"),
  isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
  index("idx_city_nodes_city").on(table.cityId),
  index("idx_city_nodes_type").on(table.type),
]);

export const cityEdges = pgTable("city_edges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cityId: varchar("city_id").notNull().default("default"),
  fromNodeId: varchar("from_node_id").notNull().references(() => cityNodes.id, { onDelete: "cascade" }),
  toNodeId: varchar("to_node_id").notNull().references(() => cityNodes.id, { onDelete: "cascade" }),
  distanceKm: text("distance_km").notNull(),
  travelTimeMinutes: integer("travel_time_minutes").notNull(),
  roadType: varchar("road_type").default("primary"),
  congestionFactor: text("congestion_factor").default("1.0"),
}, (table) => [
  index("idx_city_edges_from").on(table.fromNodeId),
  index("idx_city_edges_to").on(table.toNodeId),
]);

export type CityNode = typeof cityNodes.$inferSelect;
export type CityEdge = typeof cityEdges.$inferSelect;

// §17.4 AI Decision Override
export const overrideStatusEnum = pgEnum("override_status", ["pending_review", "approved", "overridden", "auto_approved"]);

export const aiOverrides = pgTable("ai_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentId: varchar("incident_id").notNull(),
  incidentType: varchar("incident_type").notNull().default("disaster_report"),
  originalDecision: jsonb("original_decision").notNull(),
  overriddenDecision: jsonb("overridden_decision"),
  aiConfidence: text("ai_confidence").notNull(),
  aiUrgency: text("ai_urgency"),
  requiresHumanReview: boolean("requires_human_review").default(false).notNull(),
  status: overrideStatusEnum("status").default("pending_review").notNull(),
  overriddenBy: varchar("overridden_by").references(() => users.id),
  reason: text("reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
}, (table) => [
  index("idx_ai_overrides_incident").on(table.incidentId),
  index("idx_ai_overrides_status").on(table.status),
  index("idx_ai_overrides_created").on(table.createdAt),
]);

export type AiOverride = typeof aiOverrides.$inferSelect;
export type InsertAiOverride = typeof aiOverrides.$inferInsert;

// ── Decision Engine Tables (v7.0) ─────────────────────────────────────────────

export const decisionTypeEnum = pgEnum("decision_type", ["DISPATCH", "ESCALATE", "BROADCAST", "PREDEPLOY"]);
export const decisionStatusEnum = pgEnum("decision_status", ["PENDING", "APPROVED", "EXECUTED", "REJECTED"]);

export const decisions = pgTable("decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentId: varchar("incident_id").notNull(),
  incidentTitle: text("incident_title"),
  type: decisionTypeEnum("type").notNull(),
  confidence: integer("confidence").notNull(),
  severity: severityEnum("severity").notNull(),
  reason: text("reason").notNull(),
  contributingSignals: jsonb("contributing_signals").notNull().$type<{
    aiUrgency: number;
    locationRisk: number;
    repetition: number;
    trust: number;
  }>(),
  recommendedActions: jsonb("recommended_actions").$type<Array<{
    type: string;
    priority: number;
    parameters: Record<string, unknown>;
  }>>(),
  autoExecutable: boolean("auto_executable").default(false).notNull(),
  status: decisionStatusEnum("status").default("PENDING").notNull(),
  executedAt: timestamp("executed_at"),
  executedBy: varchar("executed_by").references(() => users.id),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedReason: text("rejected_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_decisions_incident").on(table.incidentId),
  index("idx_decisions_status").on(table.status),
  index("idx_decisions_created").on(table.createdAt),
]);

export const incidentMetrics = pgTable("incident_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentId: varchar("incident_id").notNull().unique(),
  detectedAt: timestamp("detected_at").notNull(),
  decisionAt: timestamp("decision_at"),
  dispatchedAt: timestamp("dispatched_at"),
  resolvedAt: timestamp("resolved_at"),
  slaTargetSeconds: integer("sla_target_seconds").default(60),
}, (table) => [
  index("idx_incident_metrics_incident").on(table.incidentId),
]);

export type Decision = typeof decisions.$inferSelect;
export type InsertDecision = typeof decisions.$inferInsert;
export type IncidentMetrics = typeof incidentMetrics.$inferSelect;

// ── Policy Engine ─────────────────────────────────────────────────────────────
export const policyRules = pgTable("policy_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  conditions: jsonb("conditions").notNull().$type<Array<{
    field: string;
    operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "in";
    value: string | number | string[];
  }>>(),
  logicalOperator: varchar("logical_operator", { length: 10 }).default("AND").notNull(),
  actions: jsonb("actions").notNull().$type<Array<{
    type: string;
    parameters?: Record<string, unknown>;
  }>>(),
  enabled: boolean("enabled").default(true).notNull(),
  priority: integer("priority").default(0).notNull(),
  triggerCount: integer("trigger_count").default(0).notNull(),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_policy_rules_enabled").on(table.enabled),
  index("idx_policy_rules_priority").on(table.priority),
]);

export const policyRuleLogs = pgTable("policy_rule_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: varchar("rule_id").references(() => policyRules.id).notNull(),
  triggeredBy: varchar("triggered_by", { length: 100 }),
  eventData: jsonb("event_data"),
  actionsExecuted: jsonb("actions_executed"),
  result: varchar("result", { length: 20 }).notNull().default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_policy_rule_logs_rule").on(table.ruleId),
  index("idx_policy_rule_logs_created").on(table.createdAt),
]);

export type PolicyRule = typeof policyRules.$inferSelect;
export type InsertPolicyRule = typeof policyRules.$inferInsert;
export type PolicyRuleLog = typeof policyRuleLogs.$inferSelect;

// ── §22 — Adaptive Signal Fusion: Feature Store ───────────────────────────────

export const signalFeatures = pgTable("signal_features", {
  id:               varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId:         varchar("report_id").notNull(),
  aiScore:          text("ai_score"),
  locationRisk:     text("location_risk"),
  repetitionScore:  text("repetition_score"),
  userTrust:        text("user_trust"),
  weatherScore:     text("weather_score"),
  socialScore:      text("social_score"),
  fusedScore:       text("fused_score"),
  modelVersion:     varchar("model_version", { length: 50 }),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_signal_features_report").on(table.reportId),
  index("idx_signal_features_created").on(table.createdAt),
]);

// ── §22 — Outcome Labels (training targets) ────────────────────────────────────

export const signalOutcomes = pgTable("signal_outcomes", {
  id:              varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId:        varchar("report_id").notNull().unique(),
  isRealCrisis:    boolean("is_real_crisis").notNull(),
  falsePositive:   boolean("false_positive").default(false).notNull(),
  responseTimeSec: integer("response_time_sec"),
  labelSource:     varchar("label_source", { length: 40 }).notNull(),
  labeledBy:       varchar("labeled_by"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_signal_outcomes_report").on(table.reportId),
  index("idx_signal_outcomes_created").on(table.createdAt),
]);

// ── §22 — Model Weight Versions ────────────────────────────────────────────────

export const modelWeights = pgTable("model_weights", {
  id:          varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  version:     varchar("version", { length: 50 }).notNull().unique(),
  weights:     jsonb("weights").notNull(),
  precision:   text("precision"),
  recall:      text("recall"),
  f1Score:     text("f1_score"),
  sampleCount: integer("sample_count").default(0).notNull(),
  isActive:    boolean("is_active").default(false).notNull(),
  isShadow:    boolean("is_shadow").default(false).notNull(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_model_weights_active").on(table.isActive),
  index("idx_model_weights_created").on(table.createdAt),
]);

// ── §23 — Decision Outcomes (closed-loop learning) ───────────────────────────

export const decisionOutcomes = pgTable("decision_outcomes", {
  id:              varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  decisionId:      varchar("decision_id").notNull().unique(),
  incidentId:      varchar("incident_id").notNull(),
  outcome:         varchar("outcome", { length: 20 }).notNull(),  // SUCCESS | DELAYED | FAILED
  responseTimeSec: integer("response_time_sec"),
  actionTaken:     varchar("action_taken", { length: 100 }),
  effectiveness:   integer("effectiveness"),  // 0-100 admin-scored
  notes:           text("notes"),
  recordedBy:      varchar("recorded_by"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_decision_outcomes_decision").on(table.decisionId),
  index("idx_decision_outcomes_incident").on(table.incidentId),
  index("idx_decision_outcomes_created").on(table.createdAt),
]);

export type DecisionOutcome       = typeof decisionOutcomes.$inferSelect;
export type InsertDecisionOutcome = typeof decisionOutcomes.$inferInsert;

// ── §26 — Durable Event Store ─────────────────────────────────────────────────

export const domainEvents = pgTable("domain_events", {
  id:          varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId:     varchar("event_id").notNull().unique(),       // client-generated idempotency key
  eventType:   varchar("event_type", { length: 100 }).notNull(),
  entityId:    varchar("entity_id"),
  entityType:  varchar("entity_type", { length: 50 }),
  payload:     jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  version:     integer("version").notNull().default(1),
  processedBy: jsonb("processed_by").notNull().default(sql`'[]'::jsonb`), // array of consumer IDs
  createdAt:   timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_domain_events_type").on(table.eventType),
  index("idx_domain_events_entity").on(table.entityId),
  index("idx_domain_events_created").on(table.createdAt),
  index("idx_domain_events_event_id").on(table.eventId),
]);

export type DomainEvent       = typeof domainEvents.$inferSelect;
export type InsertDomainEvent = typeof domainEvents.$inferInsert;

export type SignalFeature   = typeof signalFeatures.$inferSelect;
export type SignalOutcome    = typeof signalOutcomes.$inferSelect;
export type ModelWeight      = typeof modelWeights.$inferSelect;
export type InsertSignalFeature  = typeof signalFeatures.$inferInsert;
export type InsertSignalOutcome  = typeof signalOutcomes.$inferInsert;
export type InsertModelWeight    = typeof modelWeights.$inferInsert;
