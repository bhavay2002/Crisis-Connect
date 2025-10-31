# Security Middleware Configuration

This document details all security middleware implemented in Crisis Connect.

## Table of Contents
1. [CORS Configuration](#cors-configuration)
2. [Helmet.js Security Headers](#helmetjs-security-headers)
3. [Rate Limiting](#rate-limiting)
4. [Input Sanitization](#input-sanitization)
5. [Cookie Security](#cookie-security)
6. [CSRF Protection](#csrf-protection)
7. [HTTPS/TLS Enforcement](#httpstls-enforcement)

---

## CORS Configuration

**Location**: `server/index.ts`

Cross-Origin Resource Sharing (CORS) is strictly configured to prevent unauthorized cross-origin requests.

### Production Configuration

```typescript
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      /\.replit\.dev$/,
      /\.repl\.co$/,
    ].filter(Boolean);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (!allowed) return false;
      if (typeof allowed === 'string') {
        return origin === allowed;
      }
      return allowed.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn('CORS request blocked', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
  maxAge: 86400, // 24 hours
};
```

### Development Configuration

In development mode, CORS is permissive to allow localhost and Replit preview domains.

### Key Features

- ✅ **Whitelist-based**: Only specified origins are allowed
- ✅ **Credentials enabled**: Allows cookies and authorization headers
- ✅ **Limited methods**: Only necessary HTTP methods
- ✅ **Header restrictions**: Only specific headers allowed
- ✅ **Preflight caching**: 24-hour cache for OPTIONS requests
- ✅ **Blocked origin logging**: Failed CORS attempts are logged

### Configuration

Set `FRONTEND_URL` environment variable in production:

```bash
FRONTEND_URL=https://yourdomain.com
```

---

## Helmet.js Security Headers

**Location**: `server/index.ts`

Helmet.js sets various HTTP security headers to protect against common vulnerabilities.

### Production Headers

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"], // NO unsafe-inline or unsafe-eval
      styleSrc: ["'self'", "'unsafe-inline'"], // Styles only (lower risk)
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:", "blob:"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
}));
```

**Key Security Improvements:**
- ✅ **No** `unsafe-inline` for scripts (strong XSS protection)
- ✅ **No** `unsafe-eval` (prevents eval-based attacks)
- ⚠️ Inline styles allowed temporarily (migrate to external CSS recommended)
- ✅ Cross-Origin policies prevent Spectre-like attacks

### Security Headers Applied

#### 1. **Content Security Policy (CSP)**
Prevents XSS attacks by restricting resource sources.

- **Scripts**: Self-hosted only (no `unsafe-inline` or `unsafe-eval`)
  - ⚠️ Requires bundled scripts, no inline `<script>` tags
  - Use nonces or hashes for any necessary inline scripts
- **Styles**: Self-hosted + inline styles (temporarily)
  - ⚠️ `unsafe-inline` allowed for styles only (lower XSS risk)
  - Recommended: Move to external stylesheets for maximum security
- **Images**: Self-hosted, data URIs, HTTPS, blob
- **Connections**: Self, WebSockets (for real-time features)
- **Fonts**: Self-hosted, data URIs, HTTPS (for Google Fonts)
- **Objects**: Blocked (prevents Flash, Java exploits)
- **Frames**: Blocked (prevents clickjacking)
- **Base URI**: Restricted to self
- **Form Actions**: Restricted to self
- **Upgrade Insecure Requests**: Forces HTTPS for all resources

**XSS Protection Level**: Strong (scripts), Moderate (styles)

#### 2. **HTTP Strict Transport Security (HSTS)**
Forces HTTPS for 1 year, including subdomains.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Submit to HSTS preload**: https://hstspreload.org/

#### 3. **X-Content-Type-Options**
Prevents MIME type sniffing.

```
X-Content-Type-Options: nosniff
```

#### 4. **X-Frame-Options**
Prevents clickjacking by disallowing embedding.

```
X-Frame-Options: SAMEORIGIN
```

#### 5. **X-Download-Options**
Prevents downloads from opening directly in IE.

```
X-Download-Options: noopen
```

### Verification

Test your headers: https://securityheaders.com

**Expected Grade**: A

---

## Rate Limiting

**Location**: `server/middleware/rateLimiting.ts`

Express Rate Limit protects against brute-force and DoS attacks.

### Global Rate Limiter

```typescript
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per IP
  message: "Too many requests from this IP, please try again later.",
});
```

### Endpoint-Specific Limiters

| Endpoint | Window | Max Requests | Key |
|----------|--------|--------------|-----|
| Authentication | 15 min | 5 | IP |
| Report Submission | 1 hour | 10 | User ID |
| Resource Requests | 1 hour | 20 | User ID |
| Messages | 1 min | 30 | User ID |
| AI Requests | 1 hour | 50 | User ID |
| Verification | 5 min | 50 | User ID |

### Features

- ✅ **IP-based**: Global limiting by IP address
- ✅ **User-based**: Per-user limits for authenticated endpoints
- ✅ **Standard headers**: Sends `RateLimit-*` headers
- ✅ **Skip successful**: Some limiters only count failures
- ✅ **Custom messages**: Clear error messages for users

### Usage

```typescript
import { reportSubmissionLimiter } from "./middleware/rateLimiting";

app.post("/api/reports", 
  isAuthenticated, 
  reportSubmissionLimiter, // Apply rate limiter
  async (req, res) => {
    // Handler
  }
);
```

### Monitoring

Rate limit violations are logged:

```
logger.warn("Rate limit exceeded", { 
  ip: req.ip, 
  endpoint: req.path 
});
```

---

## Input Sanitization

**Location**: `server/index.ts`

Protects against NoSQL injection and malicious input.

### Express Mongo Sanitize

```typescript
app.use(mongoSanitize({
  replaceWith: '_', // Replace $ and . with _
  onSanitize: ({ req, key }) => {
    logger.warn('Request data sanitized', { 
      path: req.path,
      key,
      ip: req.ip,
    });
  },
}));
```

### What It Does

Removes or replaces characters that have special meaning in MongoDB:

- **`$`**: Query operators
- **`.`**: Nested object access

**Example:**

```json
// Malicious input
{
  "email": { "$gt": "" }
}

// Sanitized output
{
  "email": { "_gt": "" }
}
```

### Benefits

- ✅ Prevents NoSQL injection attacks
- ✅ Logs all sanitization attempts
- ✅ Works with Drizzle ORM (PostgreSQL) for defense-in-depth
- ✅ Protects against object pollution

### Payload Size Limits

Additional protection via body parser limits:

```typescript
app.use(express.json({ 
  limit: '10mb' // Limit JSON payload 
}));

app.use(express.urlencoded({ 
  limit: '10mb' // Limit URL-encoded payload
}));
```

Prevents memory exhaustion attacks.

---

## Cookie Security

**Location**: `server/auth/replitAuth.ts`

Session cookies are secured with multiple attributes.

### Configuration

```typescript
cookie: {
  httpOnly: true, // Prevents XSS from accessing cookie
  secure: isProduction, // HTTPS only in production
  sameSite: isProduction ? 'strict' : 'lax', // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
}
```

### Security Attributes

#### 1. **HttpOnly**
- Prevents JavaScript access to cookies
- Mitigates XSS attacks stealing session tokens
- Cannot be disabled

#### 2. **Secure**
- Ensures cookies are only sent over HTTPS
- Automatically enabled in production (`NODE_ENV=production`)
- Disabled in development for localhost testing

#### 3. **SameSite**
- **`strict`** (production): Cookie never sent on cross-site requests
- **`lax`** (development): Cookie sent on top-level navigation
- Protects against CSRF attacks

**Comparison:**

| Value | GET from External | POST from External | Navigating to Site |
|-------|-------------------|--------------------|--------------------|
| `strict` | ❌ No | ❌ No | ❌ No |
| `lax` | ❌ No | ❌ No | ✅ Yes |
| `none` | ✅ Yes | ✅ Yes | ✅ Yes |

#### 4. **MaxAge**
- Session expires after 7 days
- Prevents indefinite session hijacking
- Users must re-authenticate after expiry

### Cookie Storage

Sessions stored in PostgreSQL (not in-memory):

```typescript
const sessionStore = new pgStore({
  conString: process.env.DATABASE_URL,
  createTableIfMissing: true,
  ttl: 7 * 24 * 60 * 60 * 1000,
  tableName: "sessions",
});
```

**Benefits:**
- ✅ Survives server restarts
- ✅ Works across multiple servers (horizontal scaling)
- ✅ Can be manually revoked from database

---

## CSRF Protection

**Status**: Partially Implemented (SameSite cookies)

### Current Protection

CSRF attacks are mitigated through:

1. **SameSite Cookies** (`strict` in production)
   - Prevents cookies from being sent on cross-site requests
   - Modern browsers: >95% coverage
   - Effective against CSRF without additional tokens

2. **CORS Configuration**
   - Strictly limits which origins can make requests
   - Prevents unauthorized cross-origin POST/PUT/DELETE

### Optional: Token-Based CSRF

For legacy browser support, add CSRF tokens:

```typescript
import csrf from "csurf";
import cookieParser from "cookie-parser";

// After session setup
app.use(cookieParser());
app.use(csrf({ cookie: true }));

// In routes
app.post("/api/sensitive-action", (req, res) => {
  // Token automatically verified by middleware
});
```

**Frontend:**

```typescript
// Get token from cookie
const csrfToken = getCookie('_csrf');

// Include in requests
fetch('/api/sensitive-action', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
  },
});
```

### When to Use Tokens

- Supporting browsers < 2016 (< IE 11)
- Extra paranoia for financial/medical apps
- Regulatory compliance requirements

**Note**: Modern SameSite cookies provide equivalent protection for supported browsers.

---

## HTTPS/TLS Enforcement

### Production Environment

HTTPS is automatically enforced on Replit deployments.

**Automatic features:**
- ✅ SSL/TLS certificates provisioned
- ✅ HTTP → HTTPS redirect
- ✅ Certificate auto-renewal
- ✅ TLS 1.2+ only

### HSTS Header

Forces HTTPS for 1 year:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**What it does:**
1. Browser remembers to only use HTTPS
2. Rejects insecure connections
3. Protects against downgrade attacks
4. Covers all subdomains

### HSTS Preload

Submit your domain to Chrome's HSTS preload list:
https://hstspreload.org/

**Requirements:**
1. Valid certificate
2. Redirect HTTP → HTTPS (status 301)
3. Serve HSTS header on base domain
4. `includeSubDomains` directive
5. `preload` directive
6. Max age ≥ 31536000 seconds (1 year)

### Development Environment

- HTTP allowed for localhost
- HSTS disabled (no HTTPS)
- Secure cookies disabled
- CSP relaxed for dev tools

### Verification

Test your TLS configuration:
https://www.ssllabs.com/ssltest/

**Expected Grade**: A+

---

## Security Checklist

### Startup Verification

When starting the application, verify:

- [ ] All security middleware loaded
- [ ] CORS configured correctly
- [ ] Rate limiters active
- [ ] Helmet headers set
- [ ] Session cookies secure
- [ ] HTTPS enforced (production)
- [ ] No errors in startup logs

### Runtime Monitoring

Monitor these security events:

- [ ] CORS violations (`logger.warn`)
- [ ] Rate limit exceeded
- [ ] Input sanitization triggers
- [ ] Failed authentication attempts
- [ ] Unusual API access patterns

### Regular Maintenance

- [ ] Run `npm audit` weekly
- [ ] Fix critical/high vulnerabilities immediately
- [ ] Review rate limit statistics monthly
- [ ] Update dependencies quarterly
- [ ] Rotate secrets quarterly
- [ ] Test security headers monthly

---

## Troubleshooting

### CORS Issues

**Problem**: Legitimate requests blocked by CORS

**Solution**:
1. Check `FRONTEND_URL` environment variable
2. Verify origin in browser DevTools
3. Add origin to allowlist in `server/index.ts`
4. Check CORS logs for blocked requests

### Rate Limiting Issues

**Problem**: Users complaining about rate limits

**Solution**:
1. Review rate limit statistics
2. Adjust limits in `server/middleware/rateLimiting.ts`
3. Consider user-based vs IP-based limiting
4. Whitelist specific IPs if needed

### Cookie Issues

**Problem**: Sessions not persisting

**Solution**:
1. Verify `SESSION_SECRET` is set
2. Check database connection
3. Verify cookies sent in requests (DevTools)
4. Check `secure` attribute matches protocol (HTTP/HTTPS)
5. Verify `sameSite` not blocking legitimate requests

### HTTPS Issues

**Problem**: Mixed content warnings

**Solution**:
1. Ensure all resources loaded over HTTPS
2. Update absolute URLs to use HTTPS
3. Use protocol-relative URLs (`//example.com/resource`)
4. Check CSP directives

---

## Resources

- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Express Rate Limit](https://github.com/express-rate-limit/express-rate-limit)
- [CORS Best Practices](https://www.npmjs.com/package/cors)
- [SameSite Cookie Specification](https://web.dev/samesite-cookies-explained/)
- [HSTS Preload List](https://hstspreload.org/)

---

**Last Updated**: October 31, 2025  
**Document Version**: 1.0  
**Review Schedule**: Quarterly
