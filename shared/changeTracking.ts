import { z } from "zod";

export interface ChangeTrackingMixin {
  createdAt: Date;
  updatedAt: Date;
  version?: number;
}

export const ifModifiedSinceSchema = z.object({
  ifModifiedSince: z.coerce.date().optional(),
  ifNoneMatch: z.string().optional(),
});

export type IfModifiedSinceParams = z.infer<typeof ifModifiedSinceSchema>;

export function generateETag(data: any): string {
  const hash = require('crypto')
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
  return `"${hash}"`;
}

export function isModified(
  lastModified: Date,
  params: IfModifiedSinceParams
): boolean {
  if (params.ifModifiedSince) {
    return lastModified > params.ifModifiedSince;
  }
  return true;
}

export function checkETag(
  currentETag: string,
  params: IfModifiedSinceParams
): boolean {
  if (params.ifNoneMatch) {
    return currentETag !== params.ifNoneMatch;
  }
  return true;
}

export class OptimisticLockError extends Error {
  constructor(message: string = "Resource was modified by another user") {
    super(message);
    this.name = "OptimisticLockError";
  }
}

export function validateVersion(
  currentVersion: number,
  providedVersion?: number
): void {
  if (providedVersion !== undefined && currentVersion !== providedVersion) {
    throw new OptimisticLockError(
      `Version mismatch: expected ${providedVersion}, got ${currentVersion}`
    );
  }
}
