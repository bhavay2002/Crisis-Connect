import type { Request } from "express";

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filter?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  sort?: {
    sortBy: string;
    sortOrder: "asc" | "desc";
  };
}

export function extractPaginationParams(query: any): PaginationParams {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 10));
  const sortBy = query.sortBy as string | undefined;
  const sortOrder = (query.sortOrder === "asc" || query.sortOrder === "desc") 
    ? query.sortOrder 
    : "desc";

  const filter: Record<string, any> = {};
  for (const key in query) {
    if (!["page", "limit", "sortBy", "sortOrder"].includes(key)) {
      filter[key] = query[key];
    }
  }

  return {
    page,
    limit,
    sortBy,
    sortOrder,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  };
}

export function getPaginationOffsets(page: number, limit: number): { offset: number; limit: number } {
  const offset = (page - 1) * limit;
  return { offset, limit };
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  sortBy?: string,
  sortOrder?: "asc" | "desc"
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    ...(sortBy && sortOrder && {
      sort: {
        sortBy,
        sortOrder,
      },
    }),
  };
}

export function parseCursorPagination(query: any): {
  cursor?: string;
  limit: number;
  direction: "forward" | "backward";
} {
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 10));
  const cursor = query.cursor as string | undefined;
  const direction = query.direction === "backward" ? "backward" : "forward";

  return { cursor, limit, direction };
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

export function createCursorPaginatedResponse<T>(
  data: T[],
  limit: number,
  getItemId: (item: T) => string,
  hasMore: boolean = false
): CursorPaginatedResponse<T> {
  const nextCursor = data.length > 0 && hasMore ? getItemId(data[data.length - 1]) : undefined;
  const prevCursor = data.length > 0 ? getItemId(data[0]) : undefined;

  return {
    data,
    pagination: {
      limit,
      hasNext: hasMore,
      hasPrev: !!prevCursor,
      nextCursor,
      prevCursor,
    },
  };
}
