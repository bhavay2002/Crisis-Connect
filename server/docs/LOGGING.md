# Structured Logging

A comprehensive structured logging system that replaces console.log with contextual, filterable logs.

## Why Use the Logger?

- **Structured Context**: Attach metadata to every log entry
- **Log Levels**: Filter logs by severity (DEBUG, INFO, WARN, ERROR)
- **Automatic Formatting**: Consistent timestamp and emoji icons
- **Error Tracking**: Proper error object handling with stack traces
- **Request Logging**: Built-in HTTP request logging middleware

## Basic Usage

```typescript
import { logger } from "../utils/logger";

// Info logs
logger.info("User created successfully", { userId: "123", email: "user@example.com" });

// Warning logs
logger.warn("Rate limit approaching", { userId: "123", requestCount: 95 });

// Error logs
logger.error("Database connection failed", error, { 
  database: "postgres", 
  retryAttempt: 3 
});

// Debug logs (only in development)
logger.debug("Processing task", { taskId: "abc", step: "validation" });
```

## Log Levels

The logger supports four levels (from lowest to highest):

1. **DEBUG** 🔍 - Detailed debugging information
2. **INFO** ℹ️ - General informational messages
3. **WARN** ⚠️ - Warning messages
4. **ERROR** ❌ - Error messages

Set minimum level based on environment:

```typescript
import { logger, LogLevel } from "../utils/logger";

if (config.env === "production") {
  logger.setLevel(LogLevel.INFO); // Hide DEBUG logs in production
}
```

## Request Logging

The logger includes built-in request logging middleware:

```typescript
import { logger } from "../utils/logger";

// Already configured in server/index.ts
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode}`;
    const context = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.claims?.sub,
    };

    if (res.statusCode >= 500) {
      logger.error(message, undefined, context);
    } else if (res.statusCode >= 400) {
      logger.warn(message, context);
    } else {
      logger.info(message, context);
    }
  });

  next();
});
```

## Child Loggers

Create child loggers with inherited context:

```typescript
import { logger } from "../utils/logger";

const userLogger = logger.child({ service: "user-service" });

userLogger.info("User logged in", { userId: "123" });
// Output includes both service and userId context
```

## Best Practices

### ✅ DO

```typescript
// Include relevant context
logger.info("Order processed", { 
  orderId: order.id, 
  userId: user.id, 
  amount: order.total 
});

// Use appropriate log levels
logger.error("Payment failed", error, { 
  orderId: order.id, 
  gateway: "stripe" 
});

// Log important business events
logger.info("Disaster report verified", { 
  reportId: report.id, 
  verifierId: verifier.id 
});
```

### ❌ DON'T

```typescript
// Don't use console.log
console.log("User created"); // NO!

// Don't log without context
logger.info("Success"); // Not helpful!

// Don't log sensitive data
logger.info("Login", { password: user.password }); // NEVER!

// Don't over-log
for (let i = 0; i < 10000; i++) {
  logger.debug(`Processing ${i}`); // Too much!
}
```

## Log Output Format

```
[2025-10-31T05:39:37.150Z] ℹ️ [INFO] Server started successfully
  Context: {
  "port": 5000,
  "environment": "development"
}
```

## Migration from console.log

Replace existing console statements:

```typescript
// Before
console.log("Creating user", userId);
console.error("Failed:", error);

// After
logger.info("Creating user", { userId });
logger.error("User creation failed", error, { userId });
```

## Error Logging

Proper error logging with stack traces:

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error(
    "Operation failed",
    error instanceof Error ? error : undefined,
    { 
      operation: "riskyOperation",
      userId: user.id 
    }
  );
  // Stack trace automatically included in development
}
```

## Performance Considerations

- Logs are synchronous - avoid logging in tight loops
- Use DEBUG level for verbose debugging
- Set appropriate log levels in production
- Context objects are serialized to JSON - keep them small
