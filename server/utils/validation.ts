import { z } from "zod";
import { ValidationError } from "../errors/AppError";
import type { Request } from "express";

export interface ValidationResult<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  errors: string[];
}

export function validateSchema<T>(
  schema: z.Schema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errorMessage = result.error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    throw new ValidationError(errorMessage, { errors: result.error.errors });
  }
  
  return result.data;
}

export function getUserId(req: Request): string {
  const userId = (req.user as any)?.claims?.sub;
  if (!userId) {
    throw new ValidationError("User ID not found in request");
  }
  return userId;
}

export function validatePositiveInteger(value: string | number, fieldName: string): number {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  
  if (isNaN(num) || num < 1) {
    throw new ValidationError(`${fieldName} must be a positive integer`);
  }
  
  return num;
}

export function validateUUID(value: string, fieldName: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(value)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`);
  }
  
  return value;
}

export function validateEnumValue<T extends string>(
  value: string,
  validValues: readonly T[],
  fieldName: string
): T {
  if (!validValues.includes(value as T)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${validValues.join(', ')}`
    );
  }
  
  return value as T;
}

export function validateCoordinates(lat: string | null, lon: string | null): { latitude: number; longitude: number } | null {
  if (!lat || !lon) {
    return null;
  }
  
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  
  if (isNaN(latitude) || isNaN(longitude)) {
    throw new ValidationError("Invalid GPS coordinates");
  }
  
  if (latitude < -90 || latitude > 90) {
    throw new ValidationError("Latitude must be between -90 and 90");
  }
  
  if (longitude < -180 || longitude > 180) {
    throw new ValidationError("Longitude must be between -180 and 180");
  }
  
  return { latitude, longitude };
}

export const validatePagination = (req: Request) => {
  const limit = Math.min(
    parseInt(req.query.limit as string) || 50,
    100
  );
  const offset = parseInt(req.query.offset as string) || 0;
  
  if (offset < 0) {
    throw new ValidationError("Offset must be non-negative");
  }
  
  return { limit, offset };
};

export function sanitizeHtml(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

export function validateNonEmpty(value: string | null | undefined, fieldName: string): string {
  if (!value || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`);
  }
  return value.trim();
}

export function validateArrayNotEmpty<T>(arr: T[], fieldName: string): T[] {
  if (!arr || arr.length === 0) {
    throw new ValidationError(`${fieldName} must contain at least one item`);
  }
  return arr;
}

export function checkOwnership(
  resourceOwnerId: string,
  requestUserId: string,
  resourceName: string = "resource"
): void {
  if (resourceOwnerId !== requestUserId) {
    throw new ValidationError(`You do not have permission to access this ${resourceName}`);
  }
}
