# Database Schema Improvements for Change Tracking

## Overview

To fully enable optimistic locking and change tracking, the database schema needs to be updated to include version fields. These changes should be applied when ready to implement complete change tracking.

## Required Schema Changes

### Add Version Field to All Main Tables

Add a `version` field to track concurrent modifications:

```typescript
// In shared/schema.ts

export const disasterReports = pgTable("disaster_reports", {
  // ... existing fields ...
  version: integer("version").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const resourceRequests = pgTable("resource_requests", {
  // ... existing fields ...
  version: integer("version").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aidOffers = pgTable("aid_offers", {
  // ... existing fields ...
  version: integer("version").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

## Storage Layer Updates

Update storage methods to handle version increments:

```typescript
// In server/db/storage.ts

async updateDisasterReportStatus(
  id: string,
  status: string,
  expectedVersion?: number
): Promise<DisasterReport | undefined> {
  const current = await this.getDisasterReport(id);
  if (!current) return undefined;
  
  // Validate version if provided (optimistic locking)
  if (expectedVersion !== undefined && current.version !== expectedVersion) {
    throw new OptimisticLockError(`Version mismatch: expected ${expectedVersion}, got ${current.version}`);
  }
  
  const [updated] = await db
    .update(disasterReports)
    .set({
      status,
      version: sql`${disasterReports.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(disasterReports.id, id))
    .returning();
    
  return updated;
}
```

## Service Layer Updates

Services should accept and pass version info:

```typescript
// In server/services/report.service.ts

async updateReportStatus(
  id: string,
  status: string,
  currentVersion?: number
): Promise<DisasterReport> {
  logger.info("Updating report status", { reportId: id, status, version: currentVersion });
  
  const report = await storage.updateDisasterReportStatus(id, status, currentVersion);
  if (!report) {
    throw new NotFoundError("Report");
  }
  
  return report;
}
```

## Controller Layer Updates

Controllers should extract version from request body:

```typescript
// In server/controllers/report.controller.ts

async updateReportStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, version } = req.body;

  if (!["reported", "verified", "responding", "resolved"].includes(status)) {
    throw new ValidationError("Invalid status");
  }

  const report = await reportService.updateReportStatus(id, status, version);

  this.broadcast?.({ type: "report_updated", data: report });

  res.json(report);
}
```

## Client-Side Integration

### Optimistic Locking Flow

```typescript
// Client sends current version
PATCH /api/reports/123/status
{
  "status": "resolved",
  "version": 5  // Current version known to client
}

// Success response includes new version
{
  "id": "123",
  "status": "resolved",
  "version": 6,  // Incremented
  "updatedAt": "2025-10-31T12:00:00Z"
}

// Conflict response
{
  "success": false,
  "error": {
    "message": "Version mismatch: expected 5, got 6",
    "code": "OPTIMISTIC_LOCK_ERROR",
    "statusCode": 409
  }
}
```

### ETag-Based Caching Flow

```typescript
// First request
GET /api/reports/123
Response:
  ETag: "abc123"
  Last-Modified: Thu, 31 Oct 2025 12:00:00 GMT
  Body: {...report data...}

// Subsequent request
GET /api/reports/123
If-None-Match: "abc123"
If-Modified-Since: Thu, 31 Oct 2025 12:00:00 GMT

// If unchanged
Response: 304 Not Modified

// If changed
Response:
  ETag: "def456"
  Last-Modified: Thu, 31 Oct 2025 13:00:00 GMT
  Body: {...updated report data...}
```

## Migration Steps

When ready to implement:

1. **Add version fields to schema**
   ```typescript
   // Update shared/schema.ts
   version: integer("version").notNull().default(0),
   ```

2. **Push schema to database**
   ```bash
   npm run db:push --force
   ```

3. **Update storage methods** to increment version and updatedAt

4. **Update services** to pass version parameter

5. **Update controllers** to extract version from request body

6. **Update validation schemas** to accept optional version field
   ```typescript
   export const updateReportStatusSchema = z.object({
     status: z.enum(["reported", "verified", "responding", "resolved"]),
     version: z.number().int().optional(),
   });
   ```

7. **Test optimistic locking**
   - Simulate concurrent updates
   - Verify 409 responses when version mismatch
   - Verify version increment on success

8. **Document client integration**
   - Add examples to API documentation
   - Update frontend to send version
   - Add conflict resolution UI

## Benefits

### Optimistic Locking
- Prevents lost updates in concurrent scenarios
- User-friendly error messages when conflicts occur
- Client can retry with fresh data

### ETag Caching
- Reduces bandwidth usage
- Faster response times for unchanged data
- Better user experience

### Audit Trail
- Every update tracked with timestamp
- Version history for debugging
- Can implement full audit log if needed

## Current Status

✅ Utilities implemented (`shared/changeTracking.ts`)
✅ Controller sets ETag and Last-Modified headers
✅ Controller checks If-None-Match and If-Modified-Since
⚠️  Database schema needs version fields
⚠️  Storage layer needs version increment logic
⚠️  Services need to pass version parameter

## Next Steps

1. Decide when to implement (coordinate with database migration strategy)
2. Add version fields to schema
3. Update storage layer
4. Test thoroughly
5. Document for frontend team
6. Roll out to production

## References

- [HTTP Caching (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [HTTP Conditional Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Conditional_requests)
- [Optimistic Concurrency Control](https://en.wikipedia.org/wiki/Optimistic_concurrency_control)
