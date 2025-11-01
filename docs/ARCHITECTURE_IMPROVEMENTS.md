# Architecture Improvements - Implementation Guide

This document details the architectural improvements made to Crisis Connect for better scalability, reliability, maintainability, and flexibility.

## Table of Contents
1. [Controller-Service Pattern](#controller-service-pattern)
2. [Error Handling Best Practices](#error-handling-best-practices)
3. [WebSocket Improvements](#websocket-improvements)
4. [Background Job Processing](#background-job-processing)
5. [Repository Pattern](#repository-pattern)
6. [Migration Checklist](#migration-checklist)

---

## Controller-Service Pattern

### Overview

The application now enforces a clear separation of concerns with three distinct layers:

**Routes** → **Controllers** → **Services** → **Storage/Repository**

### Layer Responsibilities

#### 1. Routes Layer (`server/routes/*.routes.ts`)

**Purpose**: Define HTTP endpoints and wire middleware
**Responsibilities**:
- Define HTTP methods and paths
- Apply middleware (authentication, rate limiting, role checks)
- Use `asyncHandler` wrapper for automatic error handling
- Bind controller methods to routes
- Keep route files thin (<150 lines)

**Example**:
```typescript
import { asyncHandler } from "../middleware/errorHandler";
import { isAuthenticated } from "../auth/replitAuth";
import { requireRole } from "../middleware/roleAuth";
import { reportController } from "../controllers/report.controller";
import { reportSubmissionLimiter } from "../middleware/rateLimiting";

export function registerReportRoutes(app: Express) {
  // Public endpoint
  app.get("/api/reports", 
    asyncHandler(reportController.getAllReports.bind(reportController))
  );

  // Authenticated endpoint
  app.post("/api/reports", 
    isAuthenticated,
    reportSubmissionLimiter,
    asyncHandler(reportController.createReport.bind(reportController))
  );

  // Role-based endpoint
  app.post("/api/admin/reports/:reportId/flag", 
    isAuthenticated,
    requireRole("ngo", "admin"),
    asyncHandler(reportController.flagReport.bind(reportController))
  );
}
```

**Rules**:
- ✅ Use `asyncHandler` for all async route handlers
- ✅ Bind controller methods with `.bind(controller)`
- ✅ No business logic in routes
- ✅ No direct storage/database calls
- ❌ No try-catch blocks (handled by asyncHandler)
- ❌ No res.status().json() error responses (throw errors instead)

#### 2. Controller Layer (`server/controllers/*.controller.ts`)

**Purpose**: Handle HTTP concerns and coordinate service calls
**Responsibilities**:
- Extract and validate request parameters
- Call service methods with extracted data
- Transform service responses for HTTP
- Broadcast WebSocket events
- Log audit trails
- Handle HTTP-specific logic (status codes, response formatting)

**Example**:
```typescript
import type { Request, Response } from "express";
import { reportService } from "../services/report.service";
import { insertDisasterReportSchema } from "@shared/schema";
import { ForbiddenError, ValidationError } from "../errors/AppError";
import { AuditLogger } from "../middleware/auditLog";

export class ReportController {
  private broadcast?: (message: any) => void;

  setBroadcast(fn: (message: any) => void): void {
    this.broadcast = fn;
  }

  async createReport(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.claims.sub;
    
    // Validate request using Zod schema
    // IMPORTANT: Use safeParse to avoid raw ZodError
    const validation = insertDisasterReportSchema.safeParse({
      ...req.body,
      userId,
    });

    if (!validation.success) {
      // Convert Zod errors to ValidationError for consistent error handling
      const errorMessage = validation.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new ValidationError(errorMessage, { errors: validation.error.errors });
    }

    // Call service to handle business logic
    const report = await reportService.createReport(validation.data);
    
    // Broadcast WebSocket event
    this.broadcast?.({ 
      type: "new_report", 
      data: report
    });
    
    // Return HTTP response
    res.status(201).json(report);
  }

  async flagReport(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.claims.sub;
    const { reportId } = req.params;
    const { flagType, adminNotes } = req.body;
    
    if (!["false_report", "duplicate", "spam"].includes(flagType)) {
      throw new ValidationError("Invalid flag type");
    }

    const report = await reportService.flagReport(reportId, flagType, userId, adminNotes);
    
    await AuditLogger.logReportFlag(userId, reportId, flagType, req);
    this.broadcast?.({ type: "report_flagged", data: report });
    
    res.json(report);
  }
}

export const reportController = new ReportController();
```

**Rules**:
- ✅ Throw AppError subclasses for validation failures
- ✅ Use Zod schemas with `.safeParse()` for request validation
- ✅ Convert Zod errors to ValidationError with descriptive messages
- ✅ Extract user ID from req.user.claims.sub
- ✅ Call service methods, don't implement business logic
- ✅ Handle WebSocket broadcasting
- ✅ Log audit events
- ❌ NO `.parse()` - Always use `.safeParse()` and throw ValidationError
- ❌ No database/storage calls (delegate to service)
- ❌ No complex business logic
- ❌ No try-catch blocks (let errors bubble to middleware)

**Critical Validation Pattern**:
```typescript
// ❌ WRONG - Throws raw ZodError (500 instead of 422)
const data = schema.parse(req.body);

// ✅ CORRECT - Throws ValidationError (proper 422 response)
const validation = schema.safeParse(req.body);
if (!validation.success) {
  const errorMessage = validation.error.errors
    .map(e => `${e.path.join('.')}: ${e.message}`)
    .join(', ');
  throw new ValidationError(errorMessage, { errors: validation.error.errors });
}
const data = validation.data;
```

#### 3. Service Layer (`server/services/*.service.ts`)

**Purpose**: Implement business logic and orchestrate operations
**Responsibilities**:
- Implement core business rules
- Orchestrate multiple storage/repository calls
- Call external APIs (AI, third-party services)
- Perform calculations and transformations
- Throw domain-specific errors
- Use structured logging

**Example**:
```typescript
import { storage } from "../db/storage";
import type { DisasterReport, InsertDisasterReport } from "@shared/schema";
import { AIValidationService } from "../validators/aiValidation";
import { clusteringService } from "../utils/clustering";
import { logger } from "../utils/logger";
import { NotFoundError, ConflictError } from "../errors/AppError";

export class ReportService {
  private aiService: AIValidationService;

  constructor() {
    this.aiService = new AIValidationService();
  }

  async createReport(data: InsertDisasterReport): Promise<DisasterReport> {
    logger.info("Creating new disaster report", { 
      userId: data.userId, 
      type: data.type,
      severity: data.severity 
    });

    // Fetch dependencies
    const recentReports = await storage.getRecentReports(200);
    
    // Run AI validation
    const aiValidation = await this.aiService.validateReport(
      {
        title: data.title,
        description: data.description,
        type: data.type,
        severity: data.severity,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
      },
      recentReports
    );

    // Combine data
    const reportWithAI = {
      ...data,
      aiValidationScore: aiValidation.score,
      aiValidationNotes: aiValidation.notes,
    };

    // Create report
    const report = await storage.createDisasterReport(reportWithAI);
    
    // Perform additional business logic
    await this.detectAndLinkDuplicates(report, recentReports);
    
    logger.info("Report created successfully", { reportId: report.id });

    return report;
  }

  async getReportById(id: string): Promise<DisasterReport> {
    const report = await storage.getDisasterReport(id);
    if (!report) {
      throw new NotFoundError("Report");
    }
    return report;
  }

  async verifyReport(userId: string, reportId: string): Promise<DisasterReport> {
    logger.info("Verifying report", { userId, reportId });
    
    // Business rule: Check for duplicate verification
    const existingVerification = await storage.getUserVerificationForReport(userId, reportId);
    if (existingVerification) {
      throw new ConflictError("You have already verified this report");
    }

    // Ensure report exists
    const report = await storage.getDisasterReport(reportId);
    if (!report) {
      throw new NotFoundError("Report");
    }

    // Create verification
    await storage.createVerification({ userId, reportId });
    await storage.incrementReportVerificationCount(reportId);

    // Return updated report
    const updatedReport = await storage.getDisasterReport(reportId);
    if (!updatedReport) {
      throw new NotFoundError("Report");
    }

    return updatedReport;
  }

  private async detectAndLinkDuplicates(
    report: DisasterReport,
    recentReports: DisasterReport[]
  ): Promise<void> {
    const duplicateCheck = clusteringService.detectDuplicates(report, recentReports);
    
    if (duplicateCheck.confidence > 0.5) {
      const similarReports = clusteringService.findSimilarReports(report, recentReports);
      const similarIds = similarReports.slice(0, 5).map(s => s.reportId);
      
      if (similarIds.length > 0) {
        await storage.updateSimilarReports(report.id, similarIds);
        
        // Bidirectional linking
        for (const similarId of similarIds) {
          const existingReport = await storage.getDisasterReport(similarId);
          if (existingReport) {
            const updatedSimilarIds = Array.from(new Set([
              ...(existingReport.similarReportIds || []),
              report.id
            ]));
            await storage.updateSimilarReports(similarId, updatedSimilarIds);
          }
        }
      }
    }
  }
}

export const reportService = new ReportService();
```

**Rules**:
- ✅ Use structured logging (logger.info, logger.error)
- ✅ Throw AppError subclasses for domain errors
- ✅ Implement all business logic
- ✅ Orchestrate multiple storage operations
- ✅ Keep methods focused (single responsibility)
- ✅ Use private methods for complex sub-operations
- ❌ No HTTP concerns (req, res, status codes)
- ❌ No WebSocket broadcasting (delegate to controller)
- ❌ No direct request/response handling

---

## Error Handling Best Practices

### Use asyncHandler Wrapper

All route handlers MUST use the `asyncHandler` wrapper:

```typescript
// ❌ OLD WAY - Manual try-catch
app.get("/api/reports", async (req, res) => {
  try {
    const reports = await storage.getAllDisasterReports();
    res.json(reports);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Failed" });
  }
});

// ✅ NEW WAY - asyncHandler
app.get("/api/reports", 
  asyncHandler(async (req, res) => {
    const reports = await reportService.getAllReports();
    res.json(reports);
  })
);
```

### Throw AppError Subclasses

Use specific error classes instead of generic errors:

```typescript
import { 
  NotFoundError, 
  ConflictError, 
  ValidationError, 
  ForbiddenError 
} from "../errors/AppError";

// ✅ Throw specific errors
if (!report) {
  throw new NotFoundError("Report");
}

if (existingVerification) {
  throw new ConflictError("You have already verified this report");
}

if (!allowedStatuses.includes(status)) {
  throw new ValidationError("Invalid status value");
}

if (userId !== requestedUserId) {
  throw new ForbiddenError("You can only access your own reports");
}
```

### Error Response Format

All errors are automatically formatted by the global error handler:

```json
{
  "success": false,
  "error": {
    "message": "Report not found",
    "code": "NOT_FOUND",
    "statusCode": 404,
    "details": {}
  }
}
```

---

## WebSocket Improvements

### Current Pattern

WebSocket broadcasting is injected into controllers via dependency injection:

```typescript
// In routes/index.ts
function broadcastToAll(message: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Inject into controllers
reportController.setBroadcast(broadcastToAll);

// In controller
this.broadcast?.({ 
  type: "new_report", 
  data: report 
});
```

### Future Improvements Needed

1. **Authentication**: WebSocket connections should verify user identity
2. **Event Types**: Standardize event type strings
3. **Error Handling**: Add try-catch around broadcast calls
4. **Backpressure**: Implement queueing for slow clients
5. **Reconnection**: Add automatic reconnection logic

---

## Background Job Processing

### Problem

Long-running AI validations block HTTP requests, causing timeouts.

### Solution

Implement a job queue for async processing:

```typescript
// TODO: Implement job queue
import { Queue } from "bullmq";

const aiValidationQueue = new Queue("ai-validation");

// In service
async createReport(data: InsertDisasterReport): Promise<DisasterReport> {
  const report = await storage.createDisasterReport(data);
  
  // Queue AI validation instead of running inline
  await aiValidationQueue.add("validate-report", {
    reportId: report.id,
    reportData: data,
  });
  
  return report;
}

// Worker processes jobs in background
const worker = new Worker("ai-validation", async (job) => {
  const { reportId, reportData } = job.data;
  const validation = await aiService.validateReport(reportData);
  await storage.updateReportAIValidation(reportId, validation);
});
```

---

## Repository Pattern

### Current State

The `IStorage` interface is monolithic with 100+ methods mixing all concerns.

### Target State

Break into feature-specific repositories:

```typescript
// server/repositories/report.repository.ts
export interface IReportRepository {
  getById(id: string): Promise<DisasterReport | undefined>;
  getAll(): Promise<DisasterReport[]>;
  getByUserId(userId: string): Promise<DisasterReport[]>;
  getByStatus(status: string): Promise<DisasterReport[]>;
  create(report: InsertDisasterReport): Promise<DisasterReport>;
  updateStatus(id: string, status: string): Promise<DisasterReport | undefined>;
  updatePriority(id: string, priority: number): Promise<DisasterReport | undefined>;
}

// server/repositories/user.repository.ts
export interface IUserRepository {
  getById(id: string): Promise<User | undefined>;
  getByEmail(email: string): Promise<User | undefined>;
  upsert(user: UpsertUser): Promise<User>;
  updateRole(id: string, role: string): Promise<User | undefined>;
}
```

### Benefits

- **Scalability**: Can swap implementations (SQL, NoSQL, cache)
- **Testability**: Easy to mock individual repositories
- **Maintainability**: Smaller, focused interfaces
- **Flexibility**: Can optimize different data stores per feature

---

## Migration Checklist

Use this checklist when refactoring a module to the new pattern:

### Phase 1: Create Service Layer

- [ ] Create `server/services/[feature].service.ts`
- [ ] Move business logic from routes to service methods
- [ ] Use `storage` for data access (will migrate to repositories later)
- [ ] Throw AppError subclasses for domain errors
- [ ] Add structured logging with context
- [ ] Keep methods focused (single responsibility)
- [ ] Export singleton instance: `export const [feature]Service = new [Feature]Service()`

### Phase 2: Create Controller Layer

- [ ] Create `server/controllers/[feature].controller.ts`
- [ ] Extract HTTP concerns from routes
- [ ] Validate requests using Zod schemas
- [ ] Call service methods
- [ ] Handle WebSocket broadcasting
- [ ] Log audit events
- [ ] Format HTTP responses
- [ ] Export singleton instance: `export const [feature]Controller = new [Feature]Controller()`

### Phase 3: Refactor Routes

- [ ] Create `server/routes/[feature].routes.ts` (or edit existing one)
- [ ] Import `asyncHandler` from middleware
- [ ] Import controller singleton
- [ ] Replace all route handlers with `asyncHandler(controller.method.bind(controller))`
- [ ] Remove all try-catch blocks
- [ ] Remove business logic
- [ ] Apply appropriate middleware (auth, rate limiting, roles)
- [ ] Add broadcast injection if using WebSocket: `export function setBroadcastFunction(fn) { controller.setBroadcast(fn); }`
- [ ] **Wire into server**: Register routes in `server/routes/index.ts`:
  ```typescript
  import { registerReportRoutes, setBroadcastFunction as setReportBroadcast } from "./reports.routes";
  
  // In registerRoutes function:
  registerReportRoutes(app);
  setReportBroadcast(broadcastToAll);
  ```
- [ ] Delete old route file after testing

### Phase 4: Test & Validate

- [ ] Run application: `npm run dev`
- [ ] Test all endpoints with Postman/curl
- [ ] Verify error responses use standardized format
- [ ] Check structured logs appear correctly
- [ ] Verify WebSocket events broadcast
- [ ] Test role-based access control
- [ ] Update tests to use new structure

### Phase 5: Document

- [ ] Add JSDoc comments to public service methods
- [ ] Update ARCHITECTURE.md if adding new patterns
- [ ] Create example usage in comments
- [ ] Document any breaking changes

---

## Code Examples

### Complete Module Example

See the **reports** module for a complete reference implementation:

- **Service**: `server/services/report.service.ts`
- **Controller**: `server/controllers/report.controller.ts`
- **Routes**: `server/routes/reports.routes.refactored.ts`
- **Legacy (for comparison)**: `server/routes/reports.routes.ts`

### Key Files to Study

1. `server/middleware/errorHandler.ts` - asyncHandler and global error handling
2. `server/errors/AppError.ts` - Custom error classes
3. `server/middleware/roleAuth.ts` - Role-based access control
4. `server/utils/logger.ts` - Structured logging
5. `shared/validation.ts` - Shared validation utilities

---

## Performance Best Practices

### Batch Operations

```typescript
// ❌ Sequential queries
for (const id of ids) {
  const report = await storage.getDisasterReport(id);
  results.push(report);
}

// ✅ Parallel queries
const results = await Promise.all(
  ids.map(id => storage.getDisasterReport(id))
);
```

### Avoid N+1 Queries

```typescript
// ❌ N+1 problem
const reports = await storage.getAllReports();
for (const report of reports) {
  report.user = await storage.getUser(report.userId);
}

// ✅ Batch fetch
const reports = await storage.getAllReports();
const userIds = [...new Set(reports.map(r => r.userId))];
const users = await storage.getUsersByIds(userIds);
const userMap = new Map(users.map(u => [u.id, u]));
reports.forEach(r => r.user = userMap.get(r.userId));
```

### Cache Frequently Accessed Data

```typescript
// Service with caching
export class UserService {
  private userCache = new Map<string, { user: User, timestamp: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getUserById(id: string): Promise<User> {
    const cached = this.userCache.get(id);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.user;
    }

    const user = await userRepository.getById(id);
    if (!user) throw new NotFoundError("User");
    
    this.userCache.set(id, { user, timestamp: Date.now() });
    return user;
  }
}
```

---

## Next Steps

1. **Refactor remaining route modules** using the reports module as a template
2. **Implement repository pattern** to break down monolithic IStorage
3. **Add pagination utilities** for high-volume endpoints
4. **Implement background job queue** for AI validations
5. **Add WebSocket authentication** and event standardization
6. **Implement caching layer** for frequently accessed data
7. **Add comprehensive tests** for services and controllers
8. **Set up monitoring** and observability tools

---

## Questions or Issues?

Refer to the original `ARCHITECTURE.md` for foundational patterns.

For specific implementation questions, review the reports module as the reference implementation.
