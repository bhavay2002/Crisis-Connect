# Production Deployment Guide

This guide walks you through deploying Crisis Connect to production with proper security configurations.

## Pre-Deployment Checklist

### 1. Environment Variables

Set all required environment variables in your Replit deployment:

```bash
# REQUIRED
NODE_ENV=production
DATABASE_URL=<your-postgres-connection-string>
SESSION_SECRET=<generate-strong-secret-min-32-chars>
ENCRYPTION_KEY=<generate-exactly-64-hex-chars>

# OPTIONAL (but recommended)
OPENAI_API_KEY=<your-openai-key>
REPLIT_OBJECT_STORAGE_URL=<auto-configured>
REPLIT_OBJECT_STORAGE_ACCESS_KEY_ID=<auto-configured>
REPLIT_OBJECT_STORAGE_SECRET_ACCESS_KEY=<auto-configured>
```

#### Generate Secure Secrets

Run these commands to generate cryptographically secure secrets:

```bash
# Generate SESSION_SECRET (32 bytes = 64 hex characters)
# Minimum required: 32 characters. Recommended: 64+ characters
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY (32 bytes = 64 hex characters)
# EXACTLY 64 hex characters required (no more, no less)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Validation Requirements:**
- `SESSION_SECRET`: Minimum 32 characters (recommend using 64 hex)
- `ENCRYPTION_KEY`: Exactly 64 hex characters (will fail if not exact)

**IMPORTANT**: 
- Store these secrets in a secure password manager
- Never commit them to version control
- Application will **FAIL TO START** in production if secrets are missing
- You'll need them if you ever migrate the application

### 2. Database Setup

1. **Provision PostgreSQL Database**
   - Use Replit's built-in PostgreSQL (recommended)
   - Or connect to external database (AWS RDS, Neon, etc.)

2. **Apply Database Schema**
   ```bash
   npm run db:push
   ```

3. **Verify Connection**
   ```bash
   npm run db:studio
   ```

### 3. Security Configuration

#### Helmet.js (Security Headers)

Already configured in `server/index.ts`:

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
  },
}));
```

This provides:
- Content Security Policy (XSS protection)
- HTTP Strict Transport Security (HTTPS enforcement)
- X-Frame-Options (clickjacking protection)
- X-Content-Type-Options (MIME sniffing protection)

#### CSRF Protection

CSRF tokens are automatically configured:

```typescript
app.use(cookieParser());
app.use(csrf({ cookie: true }));
```

#### Rate Limiting

Rate limiters are active per endpoint:

```typescript
- Report submission: 10 requests / 15 min
- Authentication: 5 requests / 15 min
- AI requests: 20 requests / 15 min
- Messages: 30 requests / 15 min
```

Customize in `server/middleware/rateLimiting.ts` if needed.

### 4. HTTPS Configuration

Replit automatically provisions SSL certificates and enforces HTTPS. No manual configuration needed.

**Verify:**
- `cookie.secure` is set to `true` in production
- Session cookies are `httpOnly`
- HSTS header is sent

### 5. Monitoring & Logging

#### Application Logs

All logs are structured JSON:

```typescript
logger.info("User action", { userId, action: "create_report" });
logger.error("Operation failed", error, { context: "report_creation" });
```

#### Audit Logs

Sensitive operations are automatically logged to the database:

- User role changes
- Report status changes
- Admin actions (flagging, assignment)
- Resource access attempts

Query audit logs:

```sql
SELECT * FROM audit_logs
WHERE action = 'role_update'
ORDER BY created_at DESC
LIMIT 100;
```

### 6. Backup Strategy

#### Database Backups

**Automated (Recommended):**
If using Replit PostgreSQL, backups are automatic.

**Manual:**
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Restore:**
```bash
psql $DATABASE_URL < backup_20250101_120000.sql
```

#### Backup Schedule

- Daily automated backups (retained for 7 days)
- Weekly backups (retained for 30 days)
- Monthly backups (retained for 1 year)

Test restoration quarterly.

---

## Deployment Steps

### Option 1: Replit Deployment (Recommended)

1. **Click Deploy**
   - Open your Repl
   - Click "Deploy" button in top right
   - Choose "Autoscale" deployment type

2. **Configure Environment Variables**
   - Go to Secrets tab
   - Add all required secrets (see above)
   - Click "Deploy"

3. **Verify Deployment**
   - Visit your deployment URL
   - Check logs for errors
   - Test authentication flow
   - Create a test disaster report

### Option 2: Custom Deployment

If deploying outside Replit:

1. **Set Environment Variables**
   ```bash
   export NODE_ENV=production
   export DATABASE_URL=<connection-string>
   export SESSION_SECRET=<secret>
   export ENCRYPTION_KEY=<key>
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Run Database Migrations**
   ```bash
   npm run db:push
   ```

4. **Start Production Server**
   ```bash
   npm start
   ```

5. **Configure Reverse Proxy (nginx)**
   ```nginx
   server {
       listen 80;
       server_name crisisconnect.example.com;
       
       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

---

## Post-Deployment Verification

### 1. Security Headers Check

Visit: https://securityheaders.com/?q=your-deployment-url

Verify you receive an **A** grade.

### 2. SSL/TLS Check

Visit: https://www.ssllabs.com/ssltest/analyze.html?d=your-deployment-url

Verify you receive an **A** grade.

### 3. Authentication Flow

- [ ] Sign in works correctly
- [ ] Sessions persist across page reloads
- [ ] Logout clears session
- [ ] Protected routes require auth
- [ ] Unauthorized access returns 401/403

### 4. Authorization Tests

- [ ] Citizens cannot access admin endpoints
- [ ] Volunteers cannot modify others' resources
- [ ] Admins have full access
- [ ] Role middleware correctly enforces permissions

### 5. Input Validation

Test with malicious inputs:

```bash
# Test SQL injection prevention
curl -X POST https://your-app/api/reports \
  -H "Content-Type: application/json" \
  -d '{"title": "'; DROP TABLE disaster_reports; --"}'

# Should return 400 Bad Request with validation error
```

```bash
# Test XSS prevention
curl -X POST https://your-app/api/reports \
  -H "Content-Type: application/json" \
  -d '{"description": "<script>alert('XSS')</script>"}'

# Should sanitize and safely store (test by viewing in UI)
```

### 6. Rate Limiting

```bash
# Spam requests to trigger rate limit
for i in {1..20}; do
  curl -X POST https://your-app/api/reports \
    -H "Content-Type: application/json" \
    -d '{"title": "Test"}'
done

# Should receive 429 Too Many Requests after limit
```

---

## Production Maintenance

### Daily

- [ ] Review error logs
- [ ] Check server health metrics
- [ ] Monitor disk space

### Weekly

- [ ] Review audit logs for suspicious activity
- [ ] Check rate limiter statistics
- [ ] Test backup restoration on staging

### Monthly

- [ ] Update dependencies (`npm audit fix`)
- [ ] Review and rotate API keys (if compromised)
- [ ] Analyze performance metrics
- [ ] Security scan with `npm audit`

### Quarterly

- [ ] Rotate `SESSION_SECRET`
- [ ] Full security audit
- [ ] Penetration testing
- [ ] Disaster recovery drill

---

## Incident Response

### Security Breach

1. **Contain**
   - Immediately rotate all secrets
   - Revoke compromised API keys
   - Clear all active sessions
   - Enable maintenance mode

2. **Investigate**
   - Review audit logs
   - Identify attack vector
   - Determine data accessed
   - Document findings

3. **Remediate**
   - Patch vulnerability
   - Deploy fix
   - Restore from clean backup if needed
   - Notify affected users (if required by law)

4. **Prevent**
   - Update security policies
   - Add monitoring/alerts
   - Conduct postmortem
   - Train team on lessons learned

### Data Loss

1. **Stop writes** to prevent further corruption
2. **Restore from most recent backup**
3. **Replay transactions** from audit logs (if possible)
4. **Verify data integrity**
5. **Resume operations**

---

## Rollback Procedure

If a deployment introduces critical bugs:

### Quick Rollback (Replit)

1. Go to Deployments tab
2. Click on previous working deployment
3. Click "Promote to Production"

### Manual Rollback

1. **Checkout previous version**
   ```bash
   git checkout <previous-commit-sha>
   ```

2. **Rebuild**
   ```bash
   npm run build
   ```

3. **Restart server**
   ```bash
   npm start
   ```

4. **Verify** application is working

---

## Performance Optimization

### Database Indexes

Already configured in schema:

```typescript
index("idx_disaster_reports_user_id").on(table.userId),
index("idx_disaster_reports_status").on(table.status),
index("idx_disaster_reports_location").on(table.location),
```

Add more as needed for query performance.

### Caching

Consider adding Redis for:
- Session storage (for multiple servers)
- API response caching
- Rate limiting (distributed)

### Load Balancing

For high traffic:
- Use Replit Autoscale (automatic)
- Or deploy multiple instances behind load balancer
- Share sessions via PostgreSQL session store (already configured)

---

## Compliance

### GDPR (if applicable)

- [ ] Implement user data export
- [ ] Implement user data deletion
- [ ] Add privacy policy
- [ ] Add terms of service
- [ ] Cookie consent banner

### Data Retention

Configure in `server/config/index.ts`:

```typescript
dataRetention: {
  auditLogs: 365, // days
  sessions: 7,    // days
  deletedUsers: 30, // days (soft delete)
}
```

---

## Support

### Emergency Contacts

- **Security Issues**: security@crisisconnect.example.com
- **Technical Support**: support@crisisconnect.example.com
- **On-Call Engineer**: [Set up PagerDuty/OpsGenie]

### Monitoring Alerts

Set up alerts for:
- Server downtime (>1 minute)
- Error rate spike (>1% of requests)
- Database connection failures
- Disk space >90% full
- Memory usage >90%
- High CPU usage >80% sustained

---

## Resources

- [Node.js Production Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Twelve-Factor App](https://12factor.net/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

---

**Last Updated**: October 31, 2025  
**Document Version**: 1.0  
**Review Schedule**: Quarterly
