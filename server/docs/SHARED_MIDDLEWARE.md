# Shared Middleware & Utilities

Common middleware and validation utilities to reduce code duplication and maintain consistency.

## Available Middleware

### Authentication & Authorization

#### `requireAuth`
Ensures user is authenticated.

```typescript
import { requireAuth } from "../middleware/commonChecks";

router.get("/profile", requireAuth, (req, res) => {
  // User is guaranteed to be authenticated
  const userId = req.user.claims.sub;
});
```

#### `requireVerifiedIdentity`
Requires identity verification (Aadhaar).

```typescript
import { requireVerifiedIdentity } from "../middleware/commonChecks";

router.post("/emergency", requireVerifiedIdentity, (req, res) => {
  // User has verified identity
  const user = req.dbUser; // User object attached to request
});
```

#### `requirePhoneVerification`
Requires verified phone number.

```typescript
import { requirePhoneVerification } from "../middleware/commonChecks";

router.post("/sms-alerts", requirePhoneVerification, (req, res) => {
  // User has verified phone
});
```

#### `requireEmailVerification`
Requires verified email address.

```typescript
import { requireEmailVerification } from "../middleware/commonChecks";

router.post("/email-notifications", requireEmailVerification, (req, res) => {
  // User has verified email
});
```

### Validation Middleware

#### `validateBody`
Validates request body against a Zod schema.

```typescript
import { validateBody } from "../middleware/commonChecks";
import { insertDisasterReportSchema } from "@shared/schema";

router.post("/reports",
  requireAuth,
  validateBody(insertDisasterReportSchema),
  async (req, res) => {
    // req.body is validated and typed
    const report = await storage.createDisasterReport(req.body);
    res.json(report);
  }
);
```

#### `validateQuery`
Validates query parameters.

```typescript
import { validateQuery, paginationQuerySchema } from "../middleware/commonChecks";

router.get("/reports",
  validateQuery(paginationQuerySchema),
  async (req, res) => {
    // req.query is validated
    const { page, limit } = req.query;
  }
);
```

#### `validateParams`
Validates URL parameters.

```typescript
import { validateParams, uuidParamSchema } from "../middleware/commonChecks";

router.get("/reports/:id",
  validateParams(uuidParamSchema),
  async (req, res) => {
    // req.params.id is validated as UUID
  }
);
```

### Ownership Checks

#### `checkOwnership`
Verify user owns a resource.

```typescript
import { checkOwnership } from "../middleware/commonChecks";

router.delete("/reports/:id",
  requireAuth,
  checkOwnership(async (req) => {
    const report = await storage.getDisasterReport(req.params.id);
    return report.userId; // Returns owner ID
  }),
  async (req, res) => {
    // User is verified as owner
    await storage.deleteReport(req.params.id);
    res.json({ success: true });
  }
);
```

### Async Handler

#### `asyncHandler`
Wraps async route handlers to catch errors.

```typescript
import { asyncHandler } from "../middleware/commonChecks";

router.get("/reports", asyncHandler(async (req, res) => {
  const reports = await storage.getReports();
  res.json(reports);
  // Errors automatically caught and passed to error handler
}));
```

## Common Validation Schemas

Pre-built schemas for common use cases:

```typescript
import { 
  uuidParamSchema, 
  paginationQuerySchema 
} from "../middleware/commonChecks";

// UUID parameter validation
// Usage: validateParams(uuidParamSchema)
// Ensures req.params.id is a valid UUID

// Pagination query validation
// Usage: validateQuery(paginationQuerySchema)
// Validates page and limit query parameters
```

## Chaining Middleware

Combine multiple middleware for powerful validation:

```typescript
router.post("/reports/:id/verify",
  requireAuth,                      // Must be logged in
  requireVerifiedIdentity,          // Must have verified identity
  validateParams(uuidParamSchema),  // Validate ID parameter
  validateBody(verificationSchema), // Validate request body
  checkOwnership(getReportOwnerId), // Must own the report
  async (req, res) => {
    // All checks passed!
  }
);
```

## Benefits

1. **Reduced Code Duplication**: Write validation once, use everywhere
2. **Consistent Error Handling**: All middleware uses same error format
3. **Type Safety**: Zod schemas provide runtime and compile-time type safety
4. **Better Logging**: All middleware uses structured logging
5. **Easier Testing**: Test middleware independently
