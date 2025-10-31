import { z } from "zod";
import {
  insertDisasterReportSchema,
  insertResourceRequestSchema,
  insertAidOfferSchema,
  insertNotificationSchema,
} from "./schema";

/**
 * Common validation schemas
 */

// UUID validation
export const uuidSchema = z.string().uuid("Invalid ID format");

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

// Date range filter
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// Coordinate validation
export const coordinateSchema = z.object({
  latitude: z.string().regex(/^-?([0-9]{1,2}|1[0-7][0-9]|180)(\.[0-9]+)?$/, "Invalid latitude"),
  longitude: z.string().regex(/^-?([0-9]{1,2}|1[0-7][0-9]|180)(\.[0-9]+)?$/, "Invalid longitude"),
});

/**
 * Update schemas for PATCH operations
 * All fields are optional for partial updates
 */

export const updateDisasterReportSchema = insertDisasterReportSchema.partial().extend({
  id: uuidSchema,
});

export type UpdateDisasterReport = z.infer<typeof updateDisasterReportSchema>;

export const updateResourceRequestSchema = insertResourceRequestSchema.partial().extend({
  id: uuidSchema,
});

export type UpdateResourceRequest = z.infer<typeof updateResourceRequestSchema>;

export const updateAidOfferSchema = insertAidOfferSchema.partial().extend({
  id: uuidSchema,
});

export type UpdateAidOffer = z.infer<typeof updateAidOfferSchema>;

/**
 * Query/Filter schemas for GET endpoints
 */

export const disasterReportFiltersSchema = z.object({
  type: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["reported", "verified", "responding", "resolved"]).optional(),
  userId: uuidSchema.optional(),
  flagged: z.coerce.boolean().optional(),
  ...paginationSchema.shape,
  ...dateRangeSchema.shape,
});

export type DisasterReportFilters = z.infer<typeof disasterReportFiltersSchema>;

export const resourceRequestFiltersSchema = z.object({
  resourceType: z.string().optional(),
  urgency: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["pending", "in_progress", "fulfilled", "cancelled"]).optional(),
  userId: uuidSchema.optional(),
  ...paginationSchema.shape,
  ...dateRangeSchema.shape,
});

export type ResourceRequestFilters = z.infer<typeof resourceRequestFiltersSchema>;

/**
 * Validation helper functions
 */

/**
 * Validate and sanitize pagination parameters
 */
export function validatePagination(
  params: unknown,
  maxLimit: number = 100
): PaginationParams {
  const validated = paginationSchema.parse(params);
  return {
    ...validated,
    limit: Math.min(validated.limit, maxLimit),
  };
}

/**
 * Calculate pagination offset
 */
export function getPaginationOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Create paginated response metadata
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);
  
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrevious: params.page > 1,
    },
  };
}
