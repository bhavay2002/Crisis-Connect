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
  "accident",
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
