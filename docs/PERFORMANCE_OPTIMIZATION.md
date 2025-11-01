# Performance Optimization Features

This document explains the performance optimization features implemented in Crisis Connect to improve speed and scalability.

## Overview

The application includes several performance optimization strategies:
1. **Pagination** - Limit data transfer and improve response times
2. **In-Memory Caching** - Reduce database queries for frequently accessed data
3. **Database Indexes** - Speed up database queries
4. **Response Compression** - Reduce bandwidth usage
5. **Cache Invalidation** - Keep data fresh while maintaining performance

## 1. Pagination System

### Features
- Standardized pagination across all API endpoints
- Configurable page size (max 100 items per page)
- Rich pagination metadata in responses
- Support for sorting

### Usage

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sortBy` - Field to sort by (optional)
- `sortOrder` - Sort order: `asc` or `desc` (default: `desc`)

**Example Request:**
```bash
GET /api/reports?page=2&limit=50&sortOrder=desc
```

**Example Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 50,
    "total": 234,
    "totalPages": 5,
    "hasMore": true,
    "hasPrevious": true
  }
}
```

### Endpoints with Pagination
- `GET /api/reports` - All disaster reports
- `GET /api/resources/requests` - Resource requests
- `GET /api/aid/offers` - Aid offers
- More endpoints can be added as needed

## 2. In-Memory Caching

### Overview
The caching system stores frequently accessed data in memory to reduce database queries and improve response times.

### Features
- **Automatic Expiration** - Configurable TTL (Time To Live)
- **Cache Statistics** - Track hit rates and performance
- **Pattern-Based Invalidation** - Clear related cache entries
- **Size Limits** - Prevents memory overflow (max 1000 entries)
- **LRU Eviction** - Removes oldest entries when full
- **Automatic Cleanup** - Periodic removal of expired entries

### Cache TTL Presets
```typescript
VERY_SHORT: 30 seconds    // Real-time data
SHORT: 2 minutes          // Frequently changing data
MEDIUM: 5 minutes         // Default
LONG: 15 minutes          // Stable data
VERY_LONG: 1 hour         // Rarely changing data
```

### Cached Data
- Individual disaster reports (5 minutes)
- Paginated reports lists (2 minutes)
- User statistics (5 minutes)
- Dashboard data (2 minutes)
- Resource matches (5 minutes)

### Cache Invalidation Strategy
Cache is automatically invalidated when:
- New reports are created → Clears all report lists
- Reports are updated → Clears specific report + lists
- Resources are matched → Clears related caches
- Users are modified → Clears user-specific caches

### Cache Management API

**Get Cache Statistics** (Authenticated)
```bash
GET /api/cache/stats
```
Response:
```json
{
  "hits": 1523,
  "misses": 234,
  "sets": 456,
  "deletes": 89,
  "size": 342,
  "hitRate": "86.68%"
}
```

**Clear All Cache** (Admin Only)
```bash
POST /api/cache/clear
```

**Clear Specific Pattern** (Admin Only)
```bash
POST /api/cache/clear/reports:
```

## 3. Database Indexes

### Added Indexes

**Disaster Reports Table:**
- `idx_disaster_reports_user_id` - User's reports lookup
- `idx_disaster_reports_status` - Filter by status
- `idx_disaster_reports_type` - Filter by disaster type
- `idx_disaster_reports_severity` - Filter by severity
- `idx_disaster_reports_created_at` - Sort by date
- `idx_disaster_reports_status_created_at` - Composite index for common filters
- `idx_disaster_reports_type_severity` - Composite index for disaster analytics

**Verifications Table:**
- `idx_verifications_report_id` - Get all verifications for a report
- `idx_verifications_user_id` - Get user's verification history
- `unique_user_report_verification` - Prevent duplicate verifications

**Resource Requests Table:**
- `idx_resource_requests_user_id` - User's resource requests
- `idx_resource_requests_status` - Filter by status
- `idx_resource_requests_urgency` - Filter by urgency
- `idx_resource_requests_created_at` - Sort by date
- `idx_resource_requests_disaster_report_id` - Link to disaster reports

**Report Votes Table:**
- `idx_report_votes_report_id` - Get votes for a report
- `idx_report_votes_user_id` - Get user's voting history
- `unique_user_report_vote` - One vote per user per report

### Query Performance Impact
Indexes significantly speed up:
- Filtering by status, type, severity
- Sorting by date
- User-specific queries
- Join operations
- Aggregations and analytics

## 4. Response Compression

### Overview
All API responses are automatically compressed using gzip to reduce bandwidth and improve load times.

### Features
- **Automatic Compression** - Applied to all responses > 1KB
- **Smart Filtering** - Skips compression for WebSockets and streaming
- **Configurable Level** - Balanced compression (level 6)
- **Wide Support** - Works with all modern browsers

### Performance Impact
- **JSON Responses** - 70-80% size reduction
- **Text Content** - 60-70% size reduction
- **Images/Binary** - Minimal impact (already compressed)

### Example
Without compression: `Content-Length: 12,456 bytes`
With compression: `Content-Length: 2,891 bytes` (77% reduction)

## 5. Performance Best Practices

### For Frontend Developers

**1. Use Pagination**
```typescript
const { data, error } = useQuery({
  queryKey: ['/api/reports', { page: 1, limit: 20 }],
  // API automatically returns paginated response
});
```

**2. Leverage Cache**
- Let the backend cache handle frequently accessed data
- Use React Query for client-side caching
- Invalidate queries after mutations

**3. Monitor Performance**
```typescript
// Check cache performance
const stats = await fetch('/api/cache/stats');
console.log('Cache hit rate:', stats.hitRate);
```

### For Backend Developers

**1. Add Caching to New Routes**
```typescript
import { cache, CacheKeys, CacheTTL } from "../utils/cache";

app.get("/api/my-endpoint", async (req, res) => {
  const cacheKey = CacheKeys.myData(id);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);
  
  const data = await fetchData();
  cache.set(cacheKey, data, CacheTTL.MEDIUM);
  res.json(data);
});
```

**2. Invalidate Cache After Updates**
```typescript
// After creating/updating data
cache.delete(CacheKeys.report(reportId));
cache.deletePattern(/^reports:/); // Clear all report lists
```

**3. Use Pagination Utilities**
```typescript
import { extractPaginationParams, getPaginationOffsets, createPaginatedResponse } from "../utils/pagination";

app.get("/api/items", async (req, res) => {
  const params = extractPaginationParams(req.query);
  const { offset, limit } = getPaginationOffsets(params.page, params.limit);
  
  const items = await storage.getItems();
  const paginated = items.slice(offset, offset + limit);
  
  const response = createPaginatedResponse(
    paginated,
    items.length,
    params.page,
    params.limit
  );
  
  res.json(response);
});
```

## Performance Metrics

### Expected Improvements
- **Response Times** - 40-60% faster for cached requests
- **Database Load** - 50-70% reduction in queries
- **Bandwidth Usage** - 70-80% reduction with compression
- **Scalability** - Support 10x more concurrent users

### Monitoring
Track these metrics:
- Cache hit rate (target: >80%)
- Average response time (target: <200ms)
- Database query count
- Memory usage
- Bandwidth consumption

## Limitations

### In-Memory Cache
- **Not Distributed** - Cache is per-instance (not shared across servers)
- **Volatile** - Lost on restart
- **Size Limited** - Max 1000 entries
- **Use Case** - Development and moderate traffic

### For Production at Scale
Consider upgrading to:
- **Redis** - Distributed caching across multiple servers
- **CDN** - Edge caching for static content
- **Database Sharding** - Horizontal scaling
- **Load Balancing** - Distribute traffic across instances

## Configuration

### Cache Settings
```typescript
// server/utils/cache.ts
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_SIZE = 1000; // entries
```

### Compression Settings
```typescript
// server/index.ts
compression({
  threshold: 1024,  // Minimum size to compress (bytes)
  level: 6,         // Compression level (0-9)
})
```

### Pagination Limits
```typescript
// server/utils/pagination.ts
limit: z.coerce.number().int().min(1).max(100).default(20)
```

## Troubleshooting

### High Cache Miss Rate
- Increase TTL for stable data
- Check if cache is being properly set
- Review invalidation patterns

### Memory Issues
- Reduce MAX_SIZE
- Lower TTL values
- Implement more aggressive cleanup

### Slow Queries Despite Indexes
- Check if indexes are being used (EXPLAIN query)
- Consider composite indexes for common filter combinations
- Review query patterns

## Future Enhancements

Potential improvements:
1. **Redis Integration** - Distributed caching
2. **Query Result Caching** - Cache database query results
3. **Incremental Static Regeneration** - Pre-render pages
4. **Connection Pooling** - Optimize database connections
5. **Read Replicas** - Distribute read queries
