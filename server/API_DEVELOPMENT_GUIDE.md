# API Development Guide

This guide explains how to use the new API versioning, pagination, error handling, and rate limiting features in the Crisis Connect API.

## Table of Contents

1. [API Versioning](#api-versioning)
2. [Pagination](#pagination)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [OpenAPI Documentation](#openapi-documentation)

## API Versioning

All routes are currently under `/api` but are structured to support future versioning.

### Future Versioning Strategy

When creating v2 endpoints:

1. Keep existing `/api` routes as v1
2. Add new routes under `/api/v2`
3. Update the API info endpoint to list both versions

```typescript
// Example future v2 route
app.get("/api/v2/reports", v2ReportHandler);
```

## Pagination

### Using Pagination Utilities

The `pagination.ts` middleware provides utilities for implementing pagination in your routes.

#### Import the Utilities

```typescript
import {
  extractPaginationParams,
  getPaginationOffsets,
  createPaginatedResponse,
  type PaginatedResponse,
} from "../middleware/pagination";
```

#### Example: List Endpoint with Pagination

```typescript
import { extractPaginationParams, getPaginationOffsets, createPaginatedResponse } from "../middleware/pagination";

app.get("/api/reports", async (req, res) => {
  try {
    // Extract pagination params from query string
    const paginationParams = extractPaginationParams(req.query);
    const { offset, limit } = getPaginationOffsets(
      paginationParams.page,
      paginationParams.limit
    );

    // Fetch data from storage with pagination
    const { reports, total } = await storage.getPaginatedReports(
      limit,
      offset,
      paginationParams.sortBy,
      paginationParams.sortOrder
    );

    // Create paginated response
    const response = createPaginatedResponse(
      reports,
      total,
      paginationParams.page,
      paginationParams.limit,
      paginationParams.sortBy,
      paginationParams.sortOrder
    );

    res.json(response);
  } catch (error) {
    next(error); // Pass to error handler
  }
});
```

#### Filtering

Access filter params from the pagination params:

```typescript
const paginationParams = extractPaginationParams(req.query);

// Filter params are available in paginationParams.filter
const { status, severity } = paginationParams.filter || {};

// Use filters in your storage query
const reports = await storage.getReports({
  status,
  severity,
  limit,
  offset,
});
```

#### Cursor-Based Pagination (for Large Datasets)

For very large datasets, use cursor-based pagination:

```typescript
import {
  parseCursorPagination,
  createCursorPaginatedResponse,
} from "../middleware/pagination";

app.get("/api/messages", async (req, res) => {
  const { cursor, limit, direction } = parseCursorPagination(req.query);

  const { messages, hasMore } = await storage.getMessagesPaginated(
    cursor,
    limit,
    direction
  );

  const response = createCursorPaginatedResponse(
    messages,
    limit,
    (msg) => msg.id, // Function to get item ID for cursor
    hasMore
  );

  res.json(response);
});
```

## Error Handling

### Using the Error Handler

The error handler automatically converts all errors to a consistent format.

#### Import Error Utilities

```typescript
import { AppError, asyncHandler } from "../middleware/errorHandler";
```

#### Throwing Custom Errors

```typescript
// Throw an AppError with custom status and code
if (!report) {
  throw new AppError(
    404,
    "Report not found",
    "REPORT_NOT_FOUND",
    { reportId: req.params.id }
  );
}

// Permission error
if (user.role !== "admin") {
  throw new AppError(
    403,
    "Admin access required",
    "INSUFFICIENT_PERMISSIONS",
    { requiredRole: "admin", userRole: user.role }
  );
}
```

#### Using Async Handler

Wrap async route handlers to automatically catch errors:

```typescript
import { asyncHandler } from "../middleware/errorHandler";

app.get("/api/reports/:id", asyncHandler(async (req, res) => {
  const report = await storage.getReport(req.params.id);
  
  if (!report) {
    throw new AppError(404, "Report not found", "REPORT_NOT_FOUND");
  }
  
  res.json(report);
}));
```

#### Validation Errors

Zod validation errors are automatically handled:

```typescript
try {
  const validatedData = insertReportSchema.parse(req.body);
  // Use validated data
} catch (error) {
  // Error handler will format Zod errors automatically
  throw error;
}
```

## Rate Limiting

### Using Rate Limiters

Import the pre-configured rate limiters:

```typescript
import {
  authLimiter,
  reportSubmissionLimiter,
  messageLimiter,
  aiRequestLimiter,
  verificationLimiter,
} from "../middleware/rateLimiting";
```

### Apply to Routes

```typescript
// Apply specific rate limiter to a route
app.post("/api/reports", isAuthenticated, reportSubmissionLimiter, async (req, res) => {
  // Route handler
});

// Multiple middleware
app.post(
  "/api/auth/login",
  authLimiter,
  async (req, res) => {
    // Login logic
  }
);
```

### Rate Limit Configuration

See `server/config/rateLimits.ts` for all available configurations and quotas.

#### Creating Custom Rate Limiters

```typescript
import rateLimit from "express-rate-limit";
import { rateLimitConfigs } from "../config/rateLimits";

const customLimiter = rateLimit({
  ...rateLimitConfigs.default,
  max: 50, // Override max
  windowMs: 60 * 60 * 1000, // 1 hour
  message: "Custom rate limit message",
});
```

### Role-Based Quotas

Check user quotas based on role:

```typescript
import { getRoleQuota } from "../config/rateLimits";

const quota = getRoleQuota(user.role);

if (userReportsToday >= quota.reportsPerDay) {
  throw new AppError(
    429,
    "Daily report quota exceeded",
    "QUOTA_EXCEEDED",
    { limit: quota.reportsPerDay, current: userReportsToday }
  );
}
```

## OpenAPI Documentation

### Adding Documentation to Routes

Use JSDoc comments to document your routes for OpenAPI/Swagger:

```typescript
/**
 * @swagger
 * /api/v1/reports:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Get all disaster reports
 *     description: Retrieve a paginated list of all disaster reports
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SortByParam'
 *       - $ref: '#/components/parameters/SortOrderParam'
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [reported, verified, responding, resolved]
 *       - name: severity
 *         in: query
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DisasterReport'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
app.get("/api/v1/reports", async (req, res) => {
  // Implementation
});
```

### Updating Swagger Configuration

Edit `server/config/swagger.ts` to:

1. Add new schema definitions
2. Add reusable parameters
3. Add reusable responses
4. Update API information

```typescript
// Add to components.schemas
NewModel: {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
  },
},
```

## Best Practices

### 1. Always Use Pagination for Lists

```typescript
// ✅ Good
app.get("/api/items", async (req, res) => {
  const params = extractPaginationParams(req.query);
  // ... implement pagination
});

// ❌ Bad
app.get("/api/items", async (req, res) => {
  const allItems = await storage.getAllItems(); // No limit!
  res.json(allItems);
});
```

### 2. Use Async Handler for Async Routes

```typescript
// ✅ Good
app.get("/api/items/:id", asyncHandler(async (req, res) => {
  const item = await storage.getItem(req.params.id);
  res.json(item);
}));

// ❌ Bad
app.get("/api/items/:id", async (req, res) => {
  try {
    const item = await storage.getItem(req.params.id);
    res.json(item);
  } catch (error) {
    // Manual error handling
    res.status(500).json({ error });
  }
});
```

### 3. Throw AppError for Consistent Error Responses

```typescript
// ✅ Good
if (!user) {
  throw new AppError(404, "User not found", "USER_NOT_FOUND");
}

// ❌ Bad
if (!user) {
  return res.status(404).json({ message: "User not found" });
}
```

### 4. Apply Appropriate Rate Limiters

```typescript
// ✅ Good - Different limits for different operations
app.post("/api/auth/login", authLimiter, loginHandler);
app.post("/api/reports", reportSubmissionLimiter, createReport);
app.post("/api/messages", messageLimiter, sendMessage);

// ❌ Bad - Same limit for everything
app.post("/api/auth/login", globalLimiter, loginHandler);
app.post("/api/reports", globalLimiter, createReport);
```

### 5. Document All Public Endpoints

Add Swagger documentation to all public endpoints for better developer experience.

## Testing the API

### Using Swagger UI

1. Start the application
2. Navigate to `/api/v1/docs`
3. Test endpoints directly from the browser
4. View request/response schemas

### Testing Pagination

```bash
# First page
curl "http://localhost:5000/api/reports?page=1&limit=10"

# Sort by created date
curl "http://localhost:5000/api/reports?sortBy=createdAt&sortOrder=desc"

# Filter and paginate
curl "http://localhost:5000/api/reports?status=active&page=2&limit=20"
```

### Testing Rate Limits

```bash
# Make multiple requests to trigger rate limit
for i in {1..15}; do
  curl -X POST http://localhost:5000/api/reports
done

# Should receive 429 after hitting the limit
```

## Migration Guide

### Updating Existing Routes to Use New Features

1. **Add Pagination:**
   ```typescript
   // Before
   app.get("/api/items", async (req, res) => {
     const items = await storage.getAllItems();
     res.json(items);
   });

   // After
   app.get("/api/items", asyncHandler(async (req, res) => {
     const params = extractPaginationParams(req.query);
     const { offset, limit } = getPaginationOffsets(params.page, params.limit);
     const { items, total } = await storage.getPaginatedItems(limit, offset);
     const response = createPaginatedResponse(items, total, params.page, params.limit);
     res.json(response);
   }));
   ```

2. **Add Error Handling:**
   ```typescript
   // Before
   app.get("/api/items/:id", async (req, res) => {
     try {
       const item = await storage.getItem(req.params.id);
       if (!item) {
         return res.status(404).json({ message: "Not found" });
       }
       res.json(item);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });

   // After
   app.get("/api/items/:id", asyncHandler(async (req, res) => {
     const item = await storage.getItem(req.params.id);
     if (!item) {
       throw new AppError(404, "Item not found", "ITEM_NOT_FOUND");
     }
     res.json(item);
   }));
   ```

3. **Add Rate Limiting:**
   ```typescript
   // Before
   app.post("/api/items", isAuthenticated, async (req, res) => {
     // handler
   });

   // After
   import { resourceRequestLimiter } from "../middleware/rateLimiting";
   
   app.post("/api/items", isAuthenticated, resourceRequestLimiter, asyncHandler(async (req, res) => {
     // handler
   }));
   ```

## Summary

The new API infrastructure provides:

- ✅ **Versioning** - Ready for future API versions
- ✅ **Pagination** - Efficient data retrieval with cursor and offset pagination
- ✅ **Error Handling** - Consistent error responses across all endpoints
- ✅ **Rate Limiting** - Protection against abuse with role-based quotas
- ✅ **Documentation** - Interactive Swagger UI and OpenAPI spec
- ✅ **Best Practices** - Industry-standard REST API patterns

For questions or issues, refer to the Swagger documentation at `/api/v1/docs` or consult this guide.
