# Backend Organization by Features

## Overview

The backend is now organized by features using a clean, scalable architecture:

```
server/
├── services/          # Business logic layer
│   ├── report.service.ts       # Disaster report operations
│   ├── resource.service.ts     # Resource request operations
│   ├── aid.service.ts          # Aid offer operations
│   └── [feature].service.ts    # Other feature services
├── controllers/       # HTTP handling layer
│   ├── report.controller.ts    # Report HTTP endpoints
│   ├── resource.controller.ts  # Resource HTTP endpoints
│   ├── aid.controller.ts       # Aid HTTP endpoints
│   └── [feature].controller.ts # Other feature controllers
├── routes/            # Route definitions
│   ├── reports.routes.ts       # Report routes
│   ├── resources.routes.ts     # Resource routes
│   ├── aid.routes.ts           # Aid routes
│   └── [feature].routes.ts     # Other feature routes
├── middleware/        # Shared middleware
├── utils/             # Shared utilities
└── db/                # Database layer
    └── storage.ts     # Data access (to be split into repositories)
```

## Shared Utilities

### Pagination (`shared/pagination.ts`)

Provides consistent pagination across all endpoints:

```typescript
import { validatePagination, createPaginatedResponse } from "@shared/pagination";

// In controller
async getAllReports(req: Request, res: Response): Promise<void> {
  const paginationParams = validatePagination(req.query);
  const { data, total } = await reportService.getAllReports(paginationParams);
  const response = createPaginatedResponse(data, total, paginationParams);
  res.json(response);
}
```

**Query Parameters:**
- `page`: Page number (default: 1, min: 1)
- `limit`: Items per page (default: 20, min: 1, max: 100)
- `sortBy`: Field to sort by (optional)
- `sortOrder`: "asc" or "desc" (default: "desc")

**Response Format:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Filtering (`shared/filtering.ts`)

Feature-specific filters for querying data:

```typescript
import { reportFilterSchema } from "@shared/filtering";

// In controller
async getAllReports(req: Request, res: Response): Promise<void> {
  const filterValidation = reportFilterSchema.safeParse(req.query);
  const filter = filterValidation.success ? filterValidation.data : undefined;
  
  const reports = await reportService.getAllReports({ filter });
  res.json(reports);
}
```

**Available Filters:**

#### Report Filters
- `status`: "reported" | "verified" | "responding" | "resolved"
- `type`: Disaster type (fire, flood, earthquake, etc.)
- `severity`: "low" | "medium" | "high" | "critical"
- `userId`: Filter by user ID
- `location`: Location string
- `isFlagged`: Boolean
- `isConfirmed`: Boolean
- `minAIScore`: Minimum AI validation score (0-100)
- `startDate`: Filter reports after this date
- `endDate`: Filter reports before this date

#### Resource Request Filters
- `status`: "pending" | "in_progress" | "fulfilled" | "cancelled"
- `resourceType`: "food" | "water" | "shelter" | "medical" | etc.
- `urgency`: "low" | "medium" | "high" | "critical"
- `userId`: Filter by user ID
- `location`: Location string
- `startDate` / `endDate`: Date range

#### Aid Offer Filters
- `status`: "available" | "committed" | "delivered" | "cancelled"
- `aidType`: Resource type
- `userId`: Filter by user ID
- `location`: Location string
- `matchedToRequestId`: Filter by matched request
- `startDate` / `endDate`: Date range

**Example Usage:**
```
GET /api/reports?status=verified&severity=critical&startDate=2025-01-01&page=1&limit=20
GET /api/resources?resourceType=medical&urgency=critical&status=pending
GET /api/aid?status=available&location=Mumbai
```

### Change Tracking (`shared/changeTracking.ts`)

Utilities for detecting and managing data changes:

```typescript
import { generateETag, isModified, validateVersion } from "@shared/changeTracking";

// Generate ETag for caching
const etag = generateETag(data);
res.setHeader("ETag", etag);

// Check if modified
if (!isModified(resource.updatedAt, params)) {
  res.status(304).send();
  return;
}

// Optimistic locking
validateVersion(resource.version, providedVersion);
```

**Features:**
- ETag generation for HTTP caching
- Last-Modified header support
- Optimistic locking with version fields
- If-Modified-Since and If-None-Match handling

**Optimistic Locking Example:**
```typescript
// Client sends current version
PATCH /api/reports/123
{
  "version": 5,
  "status": "resolved"
}

// Server validates version hasn't changed
if (report.version !== providedVersion) {
  throw new OptimisticLockError("Resource was modified by another user");
}
```

## Feature Organization Pattern

Each feature follows the same pattern:

### 1. Service Layer

**Responsibilities:**
- Business logic
- Data validation
- Orchestration of storage operations
- Logging with context
- Throwing domain errors

**Example (`server/services/resource.service.ts`):**
```typescript
export class ResourceService {
  async createResourceRequest(data: InsertResourceRequest): Promise<ResourceRequest> {
    logger.info("Creating new resource request", {
      userId: data.userId,
      resourceType: data.resourceType,
    });

    const request = await storage.createResourceRequest(data);

    logger.info("Resource request created", { requestId: request.id });
    return request;
  }

  async getResourceRequestById(id: string): Promise<ResourceRequest> {
    const request = await storage.getResourceRequest(id);
    if (!request) {
      throw new NotFoundError("Resource request");
    }
    return request;
  }
}

export const resourceService = new ResourceService();
```

### 2. Controller Layer

**Responsibilities:**
- HTTP request/response handling
- Request validation with Zod
- Authorization checks
- WebSocket broadcasting
- Audit logging

**Example (`server/controllers/resource.controller.ts`):**
```typescript
export class ResourceController {
  private broadcast?: (message: any) => void;

  setBroadcast(fn: (message: any) => void): void {
    this.broadcast = fn;
  }

  async createResourceRequest(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.claims.sub;

    const validation = insertResourceRequestSchema.safeParse({
      ...req.body,
      userId,
    });

    if (!validation.success) {
      const errorMessage = validation.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new ValidationError(errorMessage, { errors: validation.error.errors });
    }

    const request = await resourceService.createResourceRequest(validation.data);

    this.broadcast?.({ type: "new_resource_request", data: request });

    res.status(201).json(request);
  }
}

export const resourceController = new ResourceController();
```

### 3. Routes Layer

**Responsibilities:**
- Define HTTP endpoints
- Apply middleware (auth, rate limiting, roles)
- Wire controllers to routes
- Use asyncHandler for error handling

**Example (`server/routes/resources.routes.ts`):**
```typescript
import { asyncHandler } from "../middleware/errorHandler";
import { isAuthenticated } from "../auth/replitAuth";
import { requireRole } from "../middleware/roleAuth";
import { resourceController } from "../controllers/resource.controller";

export function registerResourceRoutes(app: Express) {
  app.get("/api/resources", 
    asyncHandler(resourceController.getAllResourceRequests.bind(resourceController))
  );

  app.post("/api/resources", 
    isAuthenticated,
    asyncHandler(resourceController.createResourceRequest.bind(resourceController))
  );

  app.patch("/api/resources/:id/status",
    isAuthenticated,
    requireRole("volunteer", "ngo", "admin"),
    asyncHandler(resourceController.updateResourceRequestStatus.bind(resourceController))
  );
}
```

## Benefits of Feature-Based Organization

### 1. Scalability
- Easy to add new features without touching existing code
- Clear boundaries between features
- Can split into microservices later if needed

### 2. Maintainability
- Related code is grouped together
- Easier to understand and navigate
- Changes to one feature don't affect others

### 3. Testability
- Services can be tested independently
- Controllers can be tested with mocked services
- Clear interfaces make mocking easier

### 4. Team Collaboration
- Different teams can work on different features
- Reduced merge conflicts
- Clear ownership of features

## Data Flow

```
HTTP Request
    ↓
Routes (middleware, auth)
    ↓
Controller (validation, HTTP concerns)
    ↓
Service (business logic)
    ↓
Storage (data access)
    ↓
Database
```

## Pagination & Filtering Flow

```
Client Request:
GET /api/reports?status=verified&page=2&limit=20&sortBy=createdAt&sortOrder=desc

    ↓

Controller:
- Validate pagination params
- Validate filter params
- Pass to service

    ↓

Service:
- Apply business logic
- Call storage with params

    ↓

Storage:
- Build database query
- Apply filters
- Apply pagination
- Apply sorting
- Return data + total count

    ↓

Controller:
- Create paginated response
- Return to client

    ↓

Client Response:
{
  "data": [...20 items...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": true
  }
}
```

## Change Detection Flow

### ETag-based Caching

```
Client Request:
GET /api/reports/123
If-None-Match: "abc123"

    ↓

Controller:
- Fetch report
- Generate ETag from current data
- Compare with If-None-Match

    ↓

If ETag matches:
- Return 304 Not Modified
- Client uses cached data

If ETag differs:
- Return 200 OK with new ETag
- Client updates cache
```

### Optimistic Locking

```
Client Request:
PATCH /api/reports/123
{
  "version": 5,
  "status": "resolved"
}

    ↓

Service:
- Fetch current report
- Validate version matches
- If mismatch: throw OptimisticLockError
- If match: update report, increment version

    ↓

Success Response:
{
  "id": "123",
  "version": 6,  // Incremented
  "status": "resolved",
  "updatedAt": "2025-10-31T12:00:00Z"
}

Error Response (version mismatch):
{
  "success": false,
  "error": {
    "message": "Resource was modified by another user",
    "code": "OPTIMISTIC_LOCK_ERROR",
    "statusCode": 409
  }
}
```

## Migration Checklist

When creating a new feature module:

- [ ] Create service class in `server/services/[feature].service.ts`
- [ ] Create controller class in `server/controllers/[feature].controller.ts`
- [ ] Create routes in `server/routes/[feature].routes.ts`
- [ ] Add filter schema to `shared/filtering.ts` if needed
- [ ] Register routes in `server/routes/index.ts`
- [ ] Inject broadcast function for WebSocket support
- [ ] Add appropriate middleware (auth, rate limiting, roles)
- [ ] Use `.safeParse()` for validation in controllers
- [ ] Use structured logging in services
- [ ] Throw AppError subclasses for domain errors
- [ ] Add pagination support to list endpoints
- [ ] Add filtering support to main query endpoints
- [ ] Test all endpoints thoroughly

## Next Steps

1. **Refactor remaining modules** (chat, analytics, clustering) to follow this pattern
2. **Implement filtering at storage layer** for better performance
3. **Add database indices** for filtered fields
4. **Implement caching layer** for frequently accessed data
5. **Add comprehensive tests** for services and controllers
6. **Create API documentation** with example requests/responses

## Example API Usage

### Create Resource Request with Pagination/Filtering

```bash
# Create a new resource request
POST /api/resources
Authorization: Bearer <token>
{
  "resourceType": "medical",
  "quantity": 100,
  "urgency": "critical",
  "description": "Need medical supplies",
  "location": "Mumbai Hospital",
  "latitude": "19.0760",
  "longitude": "72.8777"
}

# Get all resources with filtering and pagination
GET /api/resources?resourceType=medical&urgency=critical&status=pending&page=1&limit=20

# Get user's own resources
GET /api/resources/user/user123

# Update resource status
PATCH /api/resources/resource123/status
{
  "status": "fulfilled"
}

# Fulfill a resource request
POST /api/resources/resource123/fulfill
```

### Report Queries with Advanced Filtering

```bash
# Get critical reports from the last 7 days
GET /api/reports?severity=critical&startDate=2025-10-24&endDate=2025-10-31&page=1&limit=20

# Get verified fire reports in Mumbai
GET /api/reports?type=fire&status=verified&location=Mumbai

# Get flagged reports
GET /api/reports/flagged/all

# Get prioritized reports
GET /api/reports/prioritized/all
```

### Aid Offers with Filtering

```bash
# Create aid offer
POST /api/aid
{
  "resourceType": "food",
  "quantity": 500,
  "description": "Packed meals",
  "location": "Delhi"
}

# Get available aid offers in Delhi
GET /api/aid?status=available&location=Delhi&page=1&limit=20

# Match aid to resource request
POST /api/aid/aid123/match
{
  "requestId": "request456"
}

# Mark as delivered
POST /api/aid/aid123/deliver
```

---

## Summary

The backend is now organized by features with:
- ✅ Clean separation of concerns (routes → controllers → services → storage)
- ✅ Shared pagination utilities for consistent data querying
- ✅ Comprehensive filtering support for all major entities
- ✅ Change tracking with ETags and optimistic locking
- ✅ Structured logging throughout
- ✅ Consistent error handling
- ✅ WebSocket broadcasting for real-time updates
- ✅ Ready for horizontal scaling and microservices migration
