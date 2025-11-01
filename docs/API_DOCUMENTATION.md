# Crisis Connect API Documentation

## Overview

Crisis Connect provides a RESTful API for real-time disaster management and emergency response coordination.

**Base URL:** `/api/v1`  
**Current Version:** 1.0.0  
**Documentation:** [/api/v1/docs](/api/v1/docs) (Swagger UI)

## API Versioning

All API endpoints are versioned using URL path prefixing. The current version is `v1`.

```
https://your-domain.com/api/v1/{resource}
```

### Version Information

Get information about available API versions:

```http
GET /api
```

**Response:**
```json
{
  "name": "Crisis Connect API",
  "version": "1.0.0",
  "apiVersions": {
    "v1": {
      "status": "active",
      "basePath": "/api/v1",
      "documentation": "/api/v1/docs"
    }
  }
}
```

### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-31T07:00:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

## Authentication

Crisis Connect uses cookie-based session authentication. Users must be authenticated to access most endpoints.

- **Type:** Session cookies
- **Cookie Name:** `connect.sid`
- **Login:** Use Replit Authentication

Protected endpoints will return `401 Unauthorized` if not authenticated.

## Pagination

List endpoints support offset-based pagination with the following query parameters:

### Query Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number (1-indexed) |
| `limit` | integer | 10 | 100 | Items per page |
| `sortBy` | string | varies | - | Field to sort by |
| `sortOrder` | string | `desc` | - | Sort order: `asc` or `desc` |

### Example Request

```http
GET /api/v1/reports?page=2&limit=20&sortBy=createdAt&sortOrder=desc
```

### Pagination Response Format

```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  },
  "sort": {
    "sortBy": "createdAt",
    "sortOrder": "desc"
  }
}
```

## Filtering

Many list endpoints support filtering via query parameters. Filter parameters vary by resource.

**Example:**
```http
GET /api/v1/reports?status=active&severity=high
```

## Sorting

Use `sortBy` and `sortOrder` query parameters to sort results.

**Example:**
```http
GET /api/v1/reports?sortBy=severity&sortOrder=desc
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse. Rate limits vary by endpoint type:

### Rate Limit Headers

Responses include standard rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1635724800
```

### Rate Limit Quotas by Role

| Endpoint Type | Free User | Volunteer | NGO | Admin |
|--------------|-----------|-----------|-----|-------|
| Reports/day | 10 | 50 | 500 | Unlimited |
| Resource Requests/day | 20 | 100 | 1000 | Unlimited |
| Aid Offers/day | 20 | 100 | 1000 | Unlimited |
| SOS Alerts/day | 5 | 20 | 100 | Unlimited |
| AI Requests/day | 50 | 200 | 1000 | Unlimited |

### Rate Limit Windows

| Category | Window | Max Requests |
|----------|--------|--------------|
| Default | 15 minutes | 100 |
| Authentication | 15 minutes | 10 |
| Report Submission | 1 hour | 10 |
| Resource Requests | 1 hour | 20 |
| Messaging | 1 minute | 30 |
| AI Requests | 1 hour | 50 |
| Verification | 15 minutes | 50 |

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": {
    "message": "Too many requests. Please try again later.",
    "code": "RATE_LIMIT_EXCEEDED",
    "statusCode": 429,
    "details": {
      "retryAfter": 60
    }
  }
}
```

## HTTP Status Codes

The API uses standard HTTP status codes:

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Successful request |
| 201 | Created | Resource successfully created |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

## Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "message": "Resource not found",
    "code": "NOT_FOUND",
    "statusCode": 404,
    "details": {}
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Request validation failed
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

## API Resources

### Authentication
- `GET /api/v1/auth/user` - Get current user
- `POST /api/v1/auth/update-role` - Update user role
- `POST /api/v1/auth/verify-email` - Verify email
- `POST /api/v1/auth/verify-phone` - Verify phone number

### Disaster Reports
- `GET /api/v1/reports` - List all reports (paginated)
- `GET /api/v1/reports/:id` - Get single report
- `POST /api/v1/reports` - Create new report
- `PATCH /api/v1/reports/:id/status` - Update report status
- `POST /api/v1/reports/:reportId/verify` - Verify a report

### Resources
- `GET /api/v1/resource-requests` - List all resource requests
- `POST /api/v1/resource-requests` - Create resource request
- `PATCH /api/v1/resource-requests/:id/status` - Update status

### Aid Offers
- `GET /api/v1/aid-offers` - List all aid offers
- `POST /api/v1/aid-offers` - Create aid offer
- `POST /api/v1/aid-offers/:id/commit` - Commit to a request

### SOS Alerts
- `POST /api/v1/sos` - Create SOS alert
- `GET /api/v1/sos/active` - Get active alerts
- `POST /api/v1/sos/:id/respond` - Respond to alert

### Chat & Messaging
- `POST /api/v1/chat/rooms` - Create chat room
- `GET /api/v1/chat/rooms` - Get user's chat rooms
- `POST /api/v1/chat/rooms/:roomId/messages` - Send message

### Analytics (Admin Only)
- `GET /api/v1/analytics/summary` - Get analytics summary
- `GET /api/v1/analytics/disaster-frequency` - Get disaster frequency data

## WebSocket API

Real-time updates are available via WebSocket connection.

**Endpoint:** `ws://your-domain.com/ws`

### Connection

```javascript
const ws = new WebSocket('ws://your-domain.com/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data.type, data.data);
};
```

### Message Types

- `new_report` - New disaster report created
- `report_updated` - Report status changed
- `new_aid_offer` - New aid offer available
- `new_sos_alert` - Emergency SOS alert
- `new_message` - New chat message

## Interactive Documentation

Visit `/api/v1/docs` for interactive Swagger UI documentation where you can:

- Browse all available endpoints
- See request/response schemas
- Test API calls directly from the browser
- View detailed parameter descriptions

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:

```http
GET /api/v1/openapi.json
```

## Best Practices

1. **Use Pagination** - Always use pagination for list endpoints to improve performance
2. **Handle Rate Limits** - Implement exponential backoff when rate limited
3. **Check Status Codes** - Always check HTTP status codes and handle errors appropriately
4. **Use HTTPS** - Always use HTTPS in production
5. **Cache Responses** - Cache responses when appropriate to reduce API calls
6. **WebSocket for Real-time** - Use WebSocket connection for real-time updates instead of polling

## Support

For API support or questions, please contact the development team or refer to the interactive documentation at `/api/v1/docs`.
