import { z } from "zod";

/**
 * Pagination utility for API endpoints
 * Provides standardized pagination with page limits and metadata
 */

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Calculate pagination offsets
 */
export function getPaginationOffsets(page: number, limit: number) {
  const offset = (page - 1) * limit;
  return { offset, limit };
}

/**
 * Create paginated response with metadata
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}

/**
 * Extract and validate pagination params from query
 */
export function extractPaginationParams(query: any): PaginationParams {
  return paginationSchema.parse(query);
}
