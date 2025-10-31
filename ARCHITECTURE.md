# Crisis Connect - Architecture & Best Practices

## Overview
This document outlines the architectural decisions, best practices, and code organization patterns used in Crisis Connect.

## Table of Contents
1. [Code Organization](#code-organization)
2. [Error Handling](#error-handling)
3. [Configuration Management](#configuration-management)
4. [Validation & Type Safety](#validation--type-safety)
5. [Logging](#logging)
6. [API Design](#api-design)
7. [Scalability Patterns](#scalability-patterns)
8. [Security](#security)

---

## Code Organization

### Directory Structure

```
server/
├── config/              # Configuration management
│   └── index.ts        # Centralized config with validation
├── errors/             # Custom error classes
│   └── AppError.ts     # Base and specific error types
├── middleware/         # Express middleware
│   └── errorHandler.ts # Global error handling
├── utils/              # Utility modules
│   ├── logger.ts       # Structured logging
│   └── clustering.ts   # Domain utilities
├── services/           # Business logic layer
├── controllers/        # Route handlers
└── routes/             # API route definitions

shared/
├── schema.ts           # Database schema & types
└── validation.ts       # Shared validation schemas
```

### Layer Responsibilities

**Routes** → **Controllers** → **Services** → **Storage/Database**

- **Routes**: Define HTTP endpoints, minimal logic
- **Controllers**: Handle HTTP concerns (request/response)
- **Services**: Contain business logic, orchestrate operations
- **Storage**: Data access layer, database operations

### Middleware Order

Critical middleware ordering in `server/index.ts`:

```typescript
// 1. Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 2. Structured request logging
app.use(requestLoggingMiddleware);

// 3. Session & authentication
app.use(session(...));
app.use(passport.initialize());
app.use(passport.session());

// 4. API routes
const server = await registerRoutes(app);

// 5. API error handlers (BEFORE frontend catch-all)
app.use("/api", notFoundHandler);  // Returns JSON 404 for missing API routes
app.use(errorHandler);             // Handles all errors with standardized JSON

// 6. Frontend catch-all (MUST be last)
if (isDevelopment) {
  await setupVite(app, server);
} else {
  serveStatic(app);
}
```

**Rationale**: The 404 and error handlers MUST be registered before the Vite/static middleware to ensure unknown API routes return JSON errors instead of the SPA HTML. The frontend catch-all should always be last to handle all non-API routes.

---

## Error Handling

### Centralized Error Management

All errors extend `AppError` base class for consistency:

```typescript
// Custom error types
import { BadRequestError, NotFoundError, ValidationError } from "@/errors/AppError";

// Usage in routes/services
throw new NotFoundError("Report");
throw new ValidationError("Invalid coordinates", { latitude, longitude });
```

### Error Response Format

All API errors follow a standardized structure:

```json
{
  "success": false,
  "error": {
    "message": "Resource not found",
    "code": "NOT_FOUND",
    "statusCode": 404,
    "details": { /* optional */ }
  }
}
```

### Async Error Handling

Use `asyncHandler` wrapper to eliminate try-catch boilerplate:

```typescript
import { asyncHandler } from "@/middleware/errorHandler";

app.get("/api/reports/:id", asyncHandler(async (req, res) => {
  const report = await storage.getDisasterReport(req.params.id);
  if (!report) throw new NotFoundError("Report");
  res.json(report);
}));
```

---

## Configuration Management

### Type-Safe Environment Variables

Configuration is centralized and validated on startup:

```typescript
import { config } from "@/config";

// Type-safe access
const apiKey = config.openai.apiKey;
const isEnabled = config.isFeatureEnabled("openai");
```

### Environment Schema

All environment variables are validated using Zod:

```typescript
// server/config/index.ts
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().optional(),
  // ... all environment variables
});
```

### Benefits

- **Type Safety**: Compile-time checking of config access
- **Validation**: Fails fast on startup if config is invalid
- **Documentation**: Schema serves as documentation
- **Testability**: Easy to mock in tests

---

## Validation & Type Safety

### Request Validation

Use Zod schemas for all input validation:

```typescript
import { insertDisasterReportSchema } from "@shared/schema";

const validatedData = insertDisasterReportSchema.parse(req.body);
```

### Pagination & Filtering

Standardized pagination with type-safe helpers:

```typescript
import { validatePagination, createPaginatedResponse } from "@shared/validation";

const params = validatePagination(req.query);
const data = await storage.getReports(params);
const response = createPaginatedResponse(data, total, params);
```

### Update Schemas

Partial schemas for PATCH operations:

```typescript
import { updateDisasterReportSchema } from "@shared/validation";

const updates = updateDisasterReportSchema.parse(req.body);
```

---

## Logging

### Structured Logging

Use the logger utility for consistent, structured logs:

```typescript
import { logger } from "@/utils/logger";

logger.info("Report created", { reportId, userId });
logger.error("Failed to process report", error, { reportId });
logger.warn("Rate limit approaching", { userId, requestCount });
logger.debug("Cache hit", { key, ttl });
```

### Log Levels

- **DEBUG**: Detailed development information
- **INFO**: General operational information
- **WARN**: Warning messages for recoverable issues
- **ERROR**: Error conditions requiring attention

### Context Propagation

Create child loggers with inherited context:

```typescript
const requestLogger = logger.child({ requestId, userId });
requestLogger.info("Processing request");
```

---

## API Design

### RESTful Conventions

- Use proper HTTP methods (GET, POST, PATCH, DELETE)
- Use plural nouns for collections (`/api/reports`)
- Use nested resources for relationships (`/api/reports/:id/votes`)
- Return appropriate status codes (200, 201, 404, 422, 500)

### Response Standards

**Success Response:**
```json
{
  "data": { /* resource */ },
  "pagination": { /* if applicable */ }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "message": "...",
    "code": "...",
    "statusCode": 400
  }
}
```

### Pagination

All list endpoints support pagination:

```
GET /api/reports?page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

---

## Scalability Patterns

### Database Optimization

1. **Indexes**: Add indexes for frequently queried fields
2. **Pagination**: Always paginate large result sets
3. **Query Optimization**: Use Drizzle query builders efficiently
4. **Connection Pooling**: Leverage Neon's serverless driver

### Caching Strategy

```typescript
// Cache frequently accessed, rarely changing data
- User profiles
- Static configuration
- Aggregated statistics
```

### Background Processing

For heavy operations:
- AI validation/detection → Queue for async processing
- Email/SMS notifications → Background jobs
- Image processing → Offload to worker threads

### Rate Limiting

Protect endpoints with rate limiting:

```typescript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
});

app.use("/api/", limiter);
```

---

## Security

### Input Validation

- **Always** validate and sanitize user input
- Use Zod schemas for type-safe validation
- Reject invalid data early

### Error Messages

- Don't expose sensitive information in errors
- Use generic messages in production
- Log detailed errors server-side

### Authentication & Authorization

- Verify authentication on protected routes
- Check user permissions (role-based access)
- Never trust client-provided user IDs

### SQL Injection Prevention

- Use Drizzle ORM's parameterized queries
- Never concatenate user input into SQL
- Validate all inputs

---

## Best Practices Checklist

### When Adding a New Feature

- [ ] Define types in `shared/schema.ts`
- [ ] Create validation schemas in `shared/validation.ts`
- [ ] Use custom error classes from `errors/AppError.ts`
- [ ] Add proper logging with context
- [ ] Implement pagination for list endpoints
- [ ] Add input validation
- [ ] Handle errors gracefully
- [ ] Update API documentation
- [ ] Consider scalability impact

### Code Quality

- [ ] Follow DRY (Don't Repeat Yourself)
- [ ] Single Responsibility Principle
- [ ] Meaningful variable names
- [ ] Add JSDoc comments for complex functions
- [ ] Type everything (no `any` unless absolutely necessary)
- [ ] Handle edge cases
- [ ] Clean up unused code

### Before Deployment

- [ ] Test error handling
- [ ] Verify environment variables
- [ ] Check database migrations
- [ ] Review security implications
- [ ] Test rate limiting
- [ ] Verify logging works
- [ ] Check performance impact

---

## Performance Optimization

### Query Optimization
- Use `SELECT` specific columns instead of `SELECT *`
- Add appropriate indexes
- Avoid N+1 queries
- Use database aggregations

### Caching
- Cache static data
- Use Redis for distributed caching
- Implement cache invalidation strategy

### Code Optimization
- Minimize synchronous operations
- Use streams for large data
- Implement pagination everywhere
- Optimize bundle size

---

## Monitoring & Observability

### Logging Best Practices
- Log all errors with context
- Use structured logging (JSON)
- Include request IDs for tracing
- Don't log sensitive data

### Metrics to Track
- API response times
- Error rates by endpoint
- Database query performance
- Cache hit/miss rates
- User activity patterns

---

## Migration Guide

### From Old Pattern to New

**Before:**
```typescript
app.get("/api/reports", async (req, res) => {
  try {
    const reports = await storage.getAllDisasterReports();
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
});
```

**After:**
```typescript
import { asyncHandler } from "@/middleware/errorHandler";
import { validatePagination, createPaginatedResponse } from "@shared/validation";
import { logger } from "@/utils/logger";

app.get("/api/reports", asyncHandler(async (req, res) => {
  const params = validatePagination(req.query);
  const { data, total } = await storage.getDisasterReports(params);
  
  logger.info("Reports fetched", { count: data.length, page: params.page });
  
  res.json(createPaginatedResponse(data, total, params));
}));
```

---

## Contributing

When contributing to this codebase:

1. Follow the established patterns
2. Add tests for new features
3. Update documentation
4. Use the logging and error handling utilities
5. Keep security in mind
6. Consider scalability impact

---

## Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Zod Validation](https://zod.dev/)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
