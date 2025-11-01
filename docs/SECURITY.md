# Security Best Practices

This document outlines the security measures implemented in Crisis Connect to protect user data and prevent common vulnerabilities.

## Table of Contents
1. [Secret Management](#secret-management)
2. [Input Validation & Sanitization](#input-validation--sanitization)
3. [SQL Injection Prevention](#sql-injection-prevention)
4. [Authentication & Authorization](#authentication--authorization)
5. [Additional Security Measures](#additional-security-measures)

---

## Secret Management

### Environment Variables

All sensitive data is stored in environment variables and **never** hardcoded in the codebase.

#### Required Environment Variables

```bash
# Database (REQUIRED)
DATABASE_URL=postgresql://...

# Session Management (REQUIRED in production, min 32 characters)
SESSION_SECRET=your-secure-random-secret-here-minimum-32-characters

# Encryption (REQUIRED in production, exactly 64 hex characters)
ENCRYPTION_KEY=your-64-character-hex-key-here-exactly-64-chars

# Replit Auth (Auto-configured on Replit)
ISSUER_URL=https://replit.com/oidc
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret

# Optional Features
OPENAI_API_KEY=sk-...
REPLIT_OBJECT_STORAGE_URL=https://...
REPLIT_OBJECT_STORAGE_ACCESS_KEY_ID=...
REPLIT_OBJECT_STORAGE_SECRET_ACCESS_KEY=...
OPENWEATHER_API_KEY=...
```

### Environment Validation

All environment variables are validated at startup using Zod schemas:

```typescript
// server/config/index.ts
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  
  // Session (REQUIRED in production, min 32 characters)
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters").optional(),
  
  // Encryption (REQUIRED in production, exactly 64 hex characters)
  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be exactly 64 characters").optional(),
  // ... more validations
});

// Production enforcement
function validateEnv(): Env {
  const parsed = envSchema.parse(process.env);
  
  // In production, enforce required security secrets
  if (parsed.NODE_ENV === "production") {
    if (!parsed.SESSION_SECRET) {
      throw new Error("SESSION_SECRET is required in production");
    }
    if (!parsed.ENCRYPTION_KEY) {
      throw new Error("ENCRYPTION_KEY is required in production");
    }
  }
  
  return parsed;
}
```

**Benefits:**
- Type-safe configuration
- Fail-fast on startup if required variables are missing
- Clear error messages for misconfigured environments

### Development vs Production

#### Development Mode
- Auto-generates encryption key (saved to `.dev-encryption-key`)
- Uses default session secret with warnings
- Returns dev-only debugging information
- Optional: Can provide SESSION_SECRET and ENCRYPTION_KEY to test production mode

#### Production Mode
- **MUST** provide `SESSION_SECRET` environment variable (minimum 32 characters)
- **MUST** provide `ENCRYPTION_KEY` environment variable (exactly 64 hex characters)
- **Application will FAIL TO START** if these secrets are missing
- Never exposes sensitive debugging information
- Uses secure cookies (HTTPS only)
- All security features are enforced at startup

### Secret Generation

Generate cryptographically secure secrets:

```bash
# Generate SESSION_SECRET (32 bytes = 64 hex characters, minimum required is 32 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY (32 bytes = 64 hex characters, exactly 64 required)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Validation:**
- SESSION_SECRET: Minimum 32 characters (recommend 64+ hex)
- ENCRYPTION_KEY: Exactly 64 hex characters (32 bytes)

### Secret Rotation

To rotate secrets in production:

1. **SESSION_SECRET Rotation** (Zero downtime):
   - Generate new secret
   - Update environment variable
   - Restart application
   - Existing sessions will be invalidated (users must re-login)

2. **ENCRYPTION_KEY Rotation** (Requires planning):
   - **WARNING**: Cannot be changed without decrypting/re-encrypting all data
   - Encrypted messages cannot be read after rotation
   - Requires data migration script
   - Plan carefully before rotating

### .gitignore Protection

The following files are automatically excluded from git:

```gitignore
.env
.env.local
.env.*.local
.dev-encryption-key
node_modules/
dist/
.replit
```

**NEVER commit:**
- API keys
- Session secrets
- Encryption keys
- Database credentials
- OAuth client secrets

---

## Input Validation & Sanitization

### Validation Strategy

Crisis Connect uses **Zod** for comprehensive input validation on both client and server.

### Server-Side Validation

Every API endpoint validates its input using Zod schemas:

#### Example: Disaster Report Creation

```typescript
// shared/schema.ts - Single source of truth
export const insertDisasterReportSchema = createInsertSchema(disasterReports).omit({
  id: true,
  createdAt: true,
  verificationCount: true,
});

// server/routes.ts - Validation in action
app.post("/api/reports", isAuthenticated, reportSubmissionLimiter, async (req: any, res) => {
  try {
    const validatedData = insertDisasterReportSchema.parse({
      ...req.body,
      userId,
    });
    // ... safe to use validatedData
  } catch (error: any) {
    if (error.name === "ZodError") {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.message });
    }
  }
});
```

### Validation Middleware

Reusable validation middleware for routes:

```typescript
// server/middleware/commonChecks.ts
export function validateBody<T extends z.ZodType>(schema: T): RequestHandler {
  return (req, res, next) => {
    try {
      req.body = validateSchema(schema, req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Usage
app.post("/api/resources", 
  validateBody(insertResourceRequestSchema),
  async (req, res) => {
    // req.body is validated and typed
  }
);
```

### Common Validation Patterns

#### UUID Validation
```typescript
export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

app.get("/api/reports/:id", 
  validateParams(uuidParamSchema),
  async (req, res) => {
    // req.params.id is guaranteed to be valid UUID
  }
);
```

#### Pagination Validation
```typescript
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
```

#### Phone Number Validation
```typescript
const phoneSchema = z.string().regex(
  /^\+?[1-9]\d{1,14}$/,
  "Invalid phone number format"
);
```

#### Aadhaar Validation
```typescript
if (!/^\d{12}$/.test(aadhaarNumber)) {
  return res.status(400).json({ 
    message: "Invalid Aadhaar number format. Must be 12 digits." 
  });
}
```

### Client-Side Validation

Forms use the same Zod schemas with React Hook Form:

```typescript
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDisasterReportSchema } from "@shared/schema";

const form = useForm({
  resolver: zodResolver(insertDisasterReportSchema.extend({
    // Add client-specific validation
  })),
  defaultValues: { /* ... */ },
});
```

### Input Sanitization

All string inputs are automatically sanitized:
- HTML tags are escaped in database storage
- Special characters are properly encoded
- XSS attempts are neutralized by React's built-in escaping

---

## SQL Injection Prevention

### Drizzle ORM

Crisis Connect uses **Drizzle ORM**, which provides automatic protection against SQL injection.

### How It Works

#### ✅ SAFE: Parameterized Queries

```typescript
// All values are automatically parameterized
const reports = await db
  .select()
  .from(disasterReports)
  .where(eq(disasterReports.userId, userId)) // Automatic parameterization
  .orderBy(desc(disasterReports.createdAt));

// SQL executed: SELECT * FROM disaster_reports WHERE user_id = $1 ORDER BY created_at DESC
// Parameters: [userId]
```

#### ✅ SAFE: Type-Safe Filtering

```typescript
const report = await db
  .update(disasterReports)
  .set({ status: "verified" })
  .where(
    and(
      eq(disasterReports.id, reportId),
      eq(disasterReports.userId, userId)
    )
  )
  .returning();

// All values are safely parameterized
```

#### ✅ SAFE: Dynamic Queries with Type Safety

```typescript
const conditions = [];
if (status) {
  conditions.push(eq(disasterReports.status, status));
}
if (severity) {
  conditions.push(eq(disasterReports.severity, severity));
}

const reports = await db
  .select()
  .from(disasterReports)
  .where(and(...conditions));
```

#### ❌ AVOIDED: Raw SQL with User Input

We **never** construct SQL queries using string concatenation:

```typescript
// NEVER DO THIS:
const query = `SELECT * FROM users WHERE email = '${userEmail}'`; // VULNERABLE!
```

### SQL Template Literals

When raw SQL is needed (e.g., database functions), we use Drizzle's `sql` template literal:

```typescript
import { sql } from "drizzle-orm";

// ✅ SAFE: Template literal with built-in escaping
const result = await db
  .select()
  .from(users)
  .where(sql`${users.email} = ${email}`); // Automatically parameterized
```

### Query Whitelisting

For dynamic sorting and filtering, we whitelist allowed values:

```typescript
const ALLOWED_SORT_FIELDS = ["createdAt", "severity", "status"] as const;
const ALLOWED_SORT_ORDERS = ["asc", "desc"] as const;

if (!ALLOWED_SORT_FIELDS.includes(sortBy)) {
  return res.status(400).json({ message: "Invalid sort field" });
}
```

---

## Authentication & Authorization

### Authentication Strategy

Crisis Connect uses **session-based authentication** with Replit Auth (OAuth 2.0 / OpenID Connect).

### Authentication Flow

1. User clicks "Sign In"
2. Redirects to Replit OAuth provider
3. User authorizes application
4. Receives OAuth tokens and user claims
5. Creates server-side session
6. Session stored in PostgreSQL (persistent, secure)

### Session Management

```typescript
// server/auth/replitAuth.ts
const sessionStore = new pgStore({
  conString: process.env.DATABASE_URL,
  createTableIfMissing: true,
  ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
  tableName: "sessions",
});

session({
  secret: process.env.SESSION_SECRET!,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,        // Prevents XSS cookie theft
    secure: isProduction,   // HTTPS only in production
    maxAge: 7 days,
  },
});
```

### Authentication Middleware

#### Basic Authentication Check

```typescript
// server/middleware/commonChecks.ts
export const requireAuth: RequestHandler = (req: any, res, next) => {
  if (!req.user || !req.user.claims || !req.user.claims.sub) {
    return next(new UnauthorizedError("Authentication required"));
  }
  next();
};

// Usage
app.get("/api/auth/user", requireAuth, async (req, res) => {
  // User is guaranteed to be authenticated
});
```

### Authorization (Role-Based Access Control)

#### User Roles

- `citizen` - Basic users, can report disasters
- `volunteer` - Can respond to disasters, offer aid
- `ngo` - NGO workers, can confirm reports, manage resources
- `admin` - Full access, can manage users and flags

#### Role Middleware

```typescript
// server/middleware/roleAuth.ts
export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return async (req: any, res, next) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);

    if (!user || !allowedRoles.includes(user.role as UserRole)) {
      return res.status(403).json({
        message: "Forbidden: Insufficient permissions",
        required: allowedRoles,
        current: user?.role,
      });
    }

    req.dbUser = user; // Attach full user object
    next();
  };
}
```

#### Pre-built Role Guards

```typescript
export const requireAdmin = requireRole("admin");
export const requireVolunteer = requireRole("volunteer", "ngo", "admin");
export const requireNGO = requireRole("ngo", "admin");

// Usage
app.post("/api/admin/flag-report", 
  requireAuth,
  requireAdmin,
  async (req, res) => {
    // Only admins can access this endpoint
  }
);
```

### Resource Ownership

Ensure users can only modify their own resources:

```typescript
app.get("/api/reports/user/:userId", requireAuth, async (req: any, res) => {
  const userId = req.user.claims.sub;
  const requestedUserId = req.params.userId;
  
  // Ensure users can only access their own reports
  if (userId !== requestedUserId) {
    return res.status(403).json({ 
      message: "Forbidden: You can only access your own reports" 
    });
  }
  
  const reports = await storage.getDisasterReportsByUser(requestedUserId);
  res.json(reports);
});
```

### Identity Verification Levels

Additional verification layers for sensitive operations:

```typescript
// Email verification required
export const requireEmailVerification: RequestHandler = async (req, res, next) => {
  const user = await storage.getUser(userId);
  if (!user.emailVerified) {
    return res.status(403).json({ message: "Email verification required" });
  }
  next();
};

// Phone verification required
export const requirePhoneVerification: RequestHandler = async (req, res, next) => {
  const user = await storage.getUser(userId);
  if (!user.phoneVerified) {
    return res.status(403).json({ message: "Phone verification required" });
  }
  next();
};

// Government ID verification required
export const requireVerifiedIdentity: RequestHandler = async (req, res, next) => {
  const user = await storage.getUser(userId);
  if (!user.identityVerifiedAt) {
    return res.status(403).json({ message: "Identity verification required" });
  }
  next();
};
```

---

## Additional Security Measures

For comprehensive details on all security middleware, see [SECURITY_MIDDLEWARE.md](docs/SECURITY_MIDDLEWARE.md).

### Rate Limiting

Prevents abuse and DDoS attacks with endpoint-specific limits:

| Endpoint | Window | Max Requests |
|----------|--------|--------------|
| Global | 15 min | 1000/IP |
| Authentication | 15 min | 5/IP |
| Report Submission | 1 hour | 10/user |
| Messages | 1 min | 30/user |

See [Rate Limiting Documentation](docs/SECURITY_MIDDLEWARE.md#rate-limiting) for full details.

### CORS Protection

Strictly configured Cross-Origin Resource Sharing:

```typescript
// Production: Whitelist-based origin validation
const corsOptions = {
  origin: [process.env.FRONTEND_URL, /\.replit\.dev$/, /\.repl\.co$/],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
};
```

See [CORS Documentation](docs/SECURITY_MIDDLEWARE.md#cors-configuration) for full details.

### Helmet.js Security Headers

Production-grade HTTP security headers:

- **HSTS**: Forces HTTPS for 1 year with subdomain coverage
- **CSP**: Content Security Policy prevents XSS attacks
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing

See [Helmet Documentation](docs/SECURITY_MIDDLEWARE.md#helmetjs-security-headers) for full details.

### Input Sanitization

Protection against NoSQL injection and malicious input:

```typescript
app.use(mongoSanitize({
  replaceWith: '_', // Remove $ and . from input
  onSanitize: ({ req, key }) => {
    logger.warn('Malicious input detected', { path: req.path, key });
  },
}));
```

See [Input Sanitization Documentation](docs/SECURITY_MIDDLEWARE.md#input-sanitization) for full details.

### CSRF Protection

Multi-layered CSRF defense:

1. **SameSite Cookies** (`strict` in production)
   - Prevents cookies from cross-site requests
   - Modern, effective protection

2. **CORS Restrictions**
   - Limits which origins can make requests

3. **Optional Token-Based** (for legacy browsers)
   - CSRF tokens available via `csurf` package

See [CSRF Documentation](docs/SECURITY_MIDDLEWARE.md#csrf-protection) for full details.

### HTTPS/TLS Enforcement

Production deployments automatically enforce HTTPS:

- ✅ Automatic SSL/TLS certificates
- ✅ HTTP → HTTPS redirect
- ✅ HSTS preload eligible
- ✅ TLS 1.2+ only

See [HTTPS Documentation](docs/SECURITY_MIDDLEWARE.md#httpstls-enforcement) for full details.

### Message Encryption

End-to-end encryption for sensitive chat messages:

```typescript
// server/utils/encryption.ts
export function encryptMessage(message: string): EncryptedMessage {
  // AES-256-GCM encryption
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  // Returns { encrypted, iv, authTag }
}
```

### Audit Logging

All sensitive operations are logged:

```typescript
await AuditLogger.logRoleUpdate(userId, targetUserId, oldRole, newRole, req);
await AuditLogger.logStatusChange(userId, reportId, oldStatus, newStatus, req);
await AuditLogger.logResourceAccess(userId, resourceId, "read", req);
```

### Error Handling

Never expose sensitive information in error messages:

```typescript
// ❌ BAD: Exposes database structure
catch (error) {
  res.status(500).json({ error: error.message });
}

// ✅ GOOD: Generic error message
catch (error) {
  logger.error("Failed to create report", error);
  res.status(500).json({ message: "Failed to create report" });
}
```

---

## Security Checklist

### Before Deploying to Production

- [ ] Set `SESSION_SECRET` environment variable
- [ ] Set `ENCRYPTION_KEY` environment variable
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS (automatic on Replit deployments)
- [ ] Review and rotate API keys
- [ ] Verify `.gitignore` excludes all secrets
- [ ] Test rate limiters are active
- [ ] Confirm CSRF protection is enabled
- [ ] Check security headers with helmet
- [ ] Audit authentication flows
- [ ] Test authorization on all protected routes
- [ ] Review and test input validation on all endpoints
- [ ] Enable database backups
- [ ] Set up monitoring and alerts

### Regular Security Maintenance

- [ ] Rotate secrets quarterly
- [ ] Update dependencies monthly (`npm audit fix`)
- [ ] Review audit logs weekly
- [ ] Test backup restoration quarterly
- [ ] Conduct security audits bi-annually
- [ ] Review and update permissions as team changes
- [ ] Monitor for suspicious activity patterns

---

## Reporting Security Issues

If you discover a security vulnerability, please email security@crisisconnect.example.com.

**Do NOT:**
- Create public GitHub issues for security vulnerabilities
- Disclose vulnerabilities before they are patched
- Exploit vulnerabilities in production

**Response Time:**
- Critical vulnerabilities: 24 hours
- High severity: 72 hours  
- Medium/Low severity: 7 days

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Zod Documentation](https://zod.dev/)
- [Drizzle ORM Security](https://orm.drizzle.team/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)
