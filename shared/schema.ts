import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  pgEnum,
  index,
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
]);

// Users table - Required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  name: text("name"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").default("citizen"),
  phoneNumber: varchar("phone_number"),
  phoneVerified: timestamp("phone_verified"),
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
  confirmedBy: varchar("confirmed_by").references(() => users.id),
  confirmedAt: timestamp("confirmed_at"),
  flagType: flagTypeEnum("flag_type"),
  flaggedBy: varchar("flagged_by").references(() => users.id),
  flaggedAt: timestamp("flagged_at"),
  adminNotes: text("admin_notes"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  assignedAt: timestamp("assigned_at"),
  priorityScore: integer("priority_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDisasterReportSchema = createInsertSchema(disasterReports).omit({
  id: true,
  verificationCount: true,
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
});

export const insertVerificationSchema = createInsertSchema(verifications).omit({
  id: true,
  createdAt: true,
});

export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type Verification = typeof verifications.$inferSelect;

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
});

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
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  emergencyType: disasterTypeEnum("emergency_type").notNull(),
  severity: severityEnum("severity").notNull(),
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
