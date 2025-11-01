# WebSocket Security

Comprehensive security measures for WebSocket connections in Crisis Connect.

## Security Features

### 1. Origin Validation (CSRF Protection)

All WebSocket upgrade requests are validated against allowed origins:

```typescript
// Allowed origins are automatically derived from request host
const allowedOrigins = [
  `http://${host}`,
  `https://${host}`,
  `http://localhost:5000`,
  `https://localhost:5000`,
];
```

**Protection against:** Cross-Site WebSocket Hijacking (CSWSH)

### 2. Session-Based Authentication

Every WebSocket connection must have a valid authenticated session:

```typescript
// Session is validated before upgrade
if (!session || !session.passport || !session.passport.user) {
  socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
  socket.destroy();
  return;
}
```

**Protection against:** Unauthorized access

### 3. Rate Limiting

Connections are rate-limited per IP address:

- **Window:** 60 seconds
- **Max attempts:** 10 connections per window
- **Status code:** 429 Too Many Requests

```typescript
if (!wsRateLimiter.isAllowed(clientIp)) {
  socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
  socket.destroy();
  return;
}
```

**Protection against:** DoS attacks, connection flooding

### 4. TLS/WSS Support

WebSocket connections automatically use secure protocol based on the deployment:

- **Development:** `ws://` (plain WebSocket)
- **Production:** `wss://` (WebSocket Secure over TLS)

The client automatically detects the correct protocol:

```typescript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}/ws`;
```

### 5. Transport Encryption (WSS)

**Primary Security Layer: Use WSS in production**

The application automatically uses the correct WebSocket protocol:
- **Development:** `ws://` (unencrypted)
- **Production (HTTPS):** `wss://` (TLS encrypted)

**WSS provides:**
- Transport-level encryption (same as HTTPS)
- Certificate validation
- Protection against eavesdropping
- Industry-standard security

**This is the primary security mechanism and is sufficient for most use cases.**

### Optional: Message-Level Encryption

Message-level encryption utilities are available in `server/utils/wsEncryption.ts` but are **not enabled by default**.

**When you might need message-level encryption:**
- End-to-end encryption requirements (client-to-client, server can't decrypt)
- Compliance requirements (HIPAA, GDPR extreme cases)
- Untrusted server infrastructure
- Need to store encrypted messages

**For Crisis Connect:**
Since the server processes and broadcasts messages, WSS transport encryption is sufficient and recommended over message-level encryption due to:
- Lower complexity
- Better performance  
- Easier debugging
- Standard industry practice

**Note:** Message-level encryption adds significant overhead and complexity. Only implement if you have specific regulatory or security requirements that mandate it.

## Security Best Practices

### Frontend

1. **Always use the provided `useWebSocket` hook** - Don't create raw WebSocket connections
2. **Never send sensitive data without encryption** - Use message-level encryption for PII
3. **Handle connection errors gracefully** - Implement proper error UI
4. **Validate server messages** - Never trust incoming data without validation

```typescript
// Good: Using the hook with proper error handling
const { isConnected, sendMessage } = useWebSocket({
  onMessage: (msg) => {
    // Validate message before processing
    if (msg.type && typeof msg.type === 'string') {
      handleMessage(msg);
    }
  },
  onDisconnect: () => {
    showNotification("Connection lost. Reconnecting...");
  },
});
```

### Backend

1. **Always validate origin** - Already implemented
2. **Always require authentication** - Already implemented
3. **Rate limit connections** - Already implemented
4. **Log security events** - Use structured logger for all rejections
5. **Never broadcast sensitive data** - Filter before broadcasting

```typescript
// Good: Filtering sensitive data before broadcast
function broadcastPublicUpdate(data: any) {
  const sanitized = {
    type: data.type,
    reportId: data.reportId,
    // Don't include user details, location, etc.
  };
  broadcastToAll(sanitized);
}
```

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Connection Rejection Rate**
   - High rate may indicate attacks
   - Monitor origin validation failures

2. **Rate Limit Triggers**
   - Track IPs hitting rate limits
   - Alert on suspicious patterns

3. **Authentication Failures**
   - Monitor failed upgrade attempts
   - Alert on brute force patterns

### Log Analysis

Search for security events:

```bash
# Find origin validation failures
grep "invalid origin" logs/

# Find rate limit violations
grep "rate limit exceeded" logs/

# Find authentication failures
grep "no valid session" logs/
```

## Incident Response

### If You Detect an Attack

1. **Identify the source** - Check logs for IP address
2. **Block at infrastructure level** - Use firewall/CDN
3. **Review logs** - Determine scope and impact
4. **Rotate secrets if needed** - If session compromise suspected
5. **Notify stakeholders** - Security team, users if needed

### Rate Limit Bypass Attempts

If legitimate users are being rate limited:

```typescript
// Temporarily increase limits (with caution)
export const wsRateLimiter = new WebSocketRateLimiter(
  60000,  // windowMs
  20      // maxAttempts (increased from 10)
);
```

Consider implementing:
- User-based rate limits (higher for authenticated users)
- Whitelist for known good IPs
- Exponential backoff for clients

## Security Checklist

Before deploying to production:

- [ ] TLS/HTTPS enabled on server
- [ ] WSS (WebSocket Secure) configured
- [ ] Origin validation tested
- [ ] Rate limiting tested
- [ ] Session authentication tested
- [ ] Security logs reviewed
- [ ] Monitoring alerts configured
- [ ] Incident response plan documented

## Common Vulnerabilities

### ❌ Cross-Site WebSocket Hijacking

**Attack:** Malicious site opens WebSocket to your server
**Mitigation:** Origin validation ✅ Implemented

### ❌ Session Hijacking

**Attack:** Stolen session cookie used for WebSocket
**Mitigation:** 
- Secure cookies ✅ Implemented
- HttpOnly cookies ✅ Implemented
- SameSite=Lax ✅ Implemented

### ❌ Message Injection

**Attack:** Crafted messages exploit server logic
**Mitigation:** 
- Input validation (implement in handlers)
- Rate limiting ✅ Implemented
- Message type whitelist (implement in handlers)

### ❌ Denial of Service

**Attack:** Flood server with connections
**Mitigation:**
- Rate limiting ✅ Implemented
- Connection limits (configure in production)
- Infrastructure-level protection (CloudFlare, etc.)

## Further Hardening

For production environments:

1. **Implement message rate limiting** - Limit messages per connection
2. **Add connection timeouts** - Close idle connections
3. **Monitor connection count** - Alert on unusual spikes
4. **Implement backpressure** - Prevent memory exhaustion
5. **Use connection pools** - Limit total concurrent connections

## References

- [WebSocket Security](https://owasp.org/www-community/attacks/WebSocket_Security)
- [OWASP WebSocket Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
- [RFC 6455 - The WebSocket Protocol](https://tools.ietf.org/html/rfc6455)
