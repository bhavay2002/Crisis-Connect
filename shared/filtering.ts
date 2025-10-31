import { z } from "zod";

export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type DateRange = z.infer<typeof dateRangeSchema>;

export const reportFilterSchema = z.object({
  status: z.enum(["reported", "verified", "responding", "resolved"]).optional(),
  type: z.enum([
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
  ]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  userId: z.string().optional(),
  location: z.string().optional(),
  isFlagged: z.coerce.boolean().optional(),
  isConfirmed: z.coerce.boolean().optional(),
  minAIScore: z.coerce.number().min(0).max(100).optional(),
  ...dateRangeSchema.shape,
});

export type ReportFilter = z.infer<typeof reportFilterSchema>;

export const resourceFilterSchema = z.object({
  status: z.enum(["pending", "in_progress", "fulfilled", "cancelled"]).optional(),
  resourceType: z.enum([
    "food",
    "water",
    "shelter",
    "medical",
    "clothing",
    "blankets",
    "other",
  ]).optional(),
  urgency: z.enum(["low", "medium", "high", "critical"]).optional(),
  userId: z.string().optional(),
  location: z.string().optional(),
  ...dateRangeSchema.shape,
});

export type ResourceFilter = z.infer<typeof resourceFilterSchema>;

export const aidFilterSchema = z.object({
  status: z.enum(["available", "committed", "delivered", "cancelled"]).optional(),
  aidType: z.enum([
    "food",
    "water",
    "shelter",
    "medical",
    "clothing",
    "blankets",
    "other",
  ]).optional(),
  userId: z.string().optional(),
  location: z.string().optional(),
  matchedToRequestId: z.string().optional(),
  ...dateRangeSchema.shape,
});

export type AidFilter = z.infer<typeof aidFilterSchema>;

export function buildWhereClause<T extends Record<string, any>>(
  filters: T
): Record<string, any> {
  const where: Record<string, any> = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      where[key] = value;
    }
  });

  return where;
}

export function applyDateRangeFilter(
  dateRange: DateRange,
  fieldName: string = "createdAt"
): { gte?: Date; lte?: Date } {
  const filter: { gte?: Date; lte?: Date } = {};

  if (dateRange.startDate) {
    filter.gte = dateRange.startDate;
  }

  if (dateRange.endDate) {
    filter.lte = dateRange.endDate;
  }

  return filter;
}
