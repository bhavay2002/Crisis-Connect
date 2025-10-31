# Performance Optimization Guide

This guide covers all the performance optimizations implemented in Crisis Connect, including database indexing, caching, query monitoring, streaming exports, and frontend optimizations.

## Table of Contents

1. [Database Performance](#database-performance)
2. [Caching Strategy](#caching-strategy)
3. [Query Monitoring](#query-monitoring)
4. [Streaming & Large Exports](#streaming--large-exports)
5. [Frontend Performance](#frontend-performance)

## Database Performance

### Existing Indexes

The database schema includes comprehensive indexes on frequently queried fields:

#### Disaster Reports
```typescript
index("idx_disaster_reports_user_id").on(table.userId)
index("idx_disaster_reports_status").on(table.status)
index("idx_disaster_reports_type").on(table.type)
index("idx_disaster_reports_severity").on(table.severity)
index("idx_disaster_reports_created_at").on(table.createdAt)
index("idx_disaster_reports_status_created_at").on(table.status, table.createdAt)
index("idx_disaster_reports_type_severity").on(table.type, table.severity)
```

#### Resource Requests
```typescript
index("idx_resource_requests_user_id").on(table.userId)
index("idx_resource_requests_status").on(table.status)
index("idx_resource_requests_urgency").on(table.urgency)
index("idx_resource_requests_created_at").on(table.createdAt)
index("idx_resource_requests_disaster_report_id").on(table.disasterReportId)
```

#### Verifications
```typescript
index("idx_verifications_report_id").on(table.reportId)
index("idx_verifications_user_id").on(table.userId)
uniqueIndex("unique_user_report_verification").on(table.reportId, table.userId)
```

### Composite Indexes

Composite indexes are used for common query patterns:

- **Status + Created Date**: For listing reports by status with recent-first sorting
- **Type + Severity**: For filtering by disaster type and severity simultaneously

### Index Best Practices

1. **Query the Most Used Fields** - Indexes exist on fields commonly used in WHERE clauses
2. **Composite for Multi-Column Queries** - Use composite indexes for queries filtering on multiple columns
3. **Monitor Index Usage** - Use query monitoring to identify missing indexes

## Caching Strategy

### In-Memory Cache

Crisis Connect uses an in-memory cache with LRU eviction and TTL management.

**Location**: `server/utils/cache.ts`

#### Features

- **TTL (Time To Live)**: Configurable expiration times
- **LRU Eviction**: Automatically removes oldest entries when max size is reached
- **Pattern-Based Invalidation**: Clear multiple cache entries by pattern
- **Statistics**: Track hits, misses, and cache efficiency

#### Usage Example

```typescript
import { cache, CacheKeys, CacheTTL } from "../utils/cache";

// Get from cache
const cached = cache.get<DisasterReport[]>(CacheKeys.reports("all"));
if (cached) {
  return res.json(cached);
}

// Fetch from database
const reports = await storage.getAllDisasterReports();

// Cache for 5 minutes
cache.set(CacheKeys.reports("all"), reports, CacheTTL.MEDIUM);
```

#### Cache TTL Presets

```typescript
CacheTTL.SHORT   // 2 minutes  - Frequently changing data
CacheTTL.MEDIUM  // 5 minutes  - Moderately changing data
CacheTTL.LONG    // 15 minutes - Rarely changing data
CacheTTL.HOUR    // 1 hour     - Static or slow-changing data
```

#### Cache Keys

Consistent cache key generation:

```typescript
CacheKeys.report(id)                    // Single report
CacheKeys.reports(filter)               // List of reports
CacheKeys.user(userId)                  // User data
CacheKeys.userStats(userId)             // User statistics
CacheKeys.dashboard(filters)            // Dashboard data
```

### Cache Invalidation

```typescript
// Delete specific key
cache.delete(CacheKeys.report(reportId));

// Delete by pattern
cache.deletePattern(/^reports:/);

// Clear all cache
cache.clear();
```

### Redis Integration (Future)

For production at scale, consider replacing the in-memory cache with Redis:

**Benefits**:
- Persistent cache across server restarts
- Shared cache across multiple server instances
- Advanced features (pub/sub, sorted sets, etc.)

## Query Monitoring

### Slow Query Detection

**Location**: `server/utils/queryMonitor.ts`

The query monitor automatically logs queries that exceed the slow query threshold (default: 1 second).

#### Usage

```typescript
import { withQueryMonitoring } from "../utils/queryMonitor";

// Wrap your database queries
const reports = await withQueryMonitoring(
  () => storage.getAllDisasterReports(),
  "getAllDisasterReports"
);
```

#### Configuration

```typescript
import { queryMonitor } from "../utils/queryMonitor";

// Set slow query threshold (in milliseconds)
queryMonitor.setSlowQueryThreshold(500); // 500ms

// Get query statistics
const stats = queryMonitor.getQueryStats();
// {
//   total: 150,
//   slow: 5,
//   avgDuration: 45.23,
//   maxDuration: 1250,
//   slowQueryThreshold: 500
// }

// Get slow queries
const slowQueries = queryMonitor.getSlowQueries(500);
```

#### Monitoring Dashboard

Query statistics are available via API:

```http
GET /api/admin/query-stats
```

**Response**:
```json
{
  "total": 150,
  "slow": 5,
  "avgDuration": 45.23,
  "maxDuration": 1250,
  "recentSlowQueries": [
    {
      "query": "getAllDisasterReports",
      "duration": 1250,
      "timestamp": "2025-10-31T07:00:00Z"
    }
  ]
}
```

## Streaming & Large Exports

### CSV and JSON Exports

**Location**: `server/utils/streamExport.ts`

Stream large datasets without loading everything into memory.

#### CSV Export

```typescript
import { StreamExporter } from "../utils/streamExport";

app.get("/api/exports/reports/csv", isAuthenticated, async (req, res) => {
  await StreamExporter.exportToCSV(
    res,
    async (offset, limit) => {
      const { reports, total } = await storage.getPaginatedDisasterReports(limit, offset);
      return {
        data: reports,
        hasMore: offset + limit < total,
      };
    },
    {
      filename: "reports-2025.csv",
      headers: ["id", "title", "type", "severity", "status"],
      batchSize: 500,
    }
  );
});
```

#### JSON Export

```typescript
await StreamExporter.exportToJSON(
  res,
  async (offset, limit) => {
    const { reports, total } = await storage.getPaginatedDisasterReports(limit, offset);
    return {
      data: reports,
      hasMore: offset + limit < total,
    };
  },
  "reports-2025.json",
  500 // batchSize
);
```

#### NDJSON Streaming

For real-time streaming, use newline-delimited JSON:

```typescript
import { streamJSONLines } from "../utils/streamExport";

await streamJSONLines(
  res,
  async (offset, limit) => {
    const reports = await storage.getPaginatedReports(limit, offset);
    return {
      data: reports,
      hasMore: offset + limit < total,
    };
  },
  500
);
```

### Export Endpoints

- `GET /api/exports/reports/csv` - Export disaster reports to CSV
- `GET /api/exports/reports/json` - Export disaster reports to JSON
- `GET /api/exports/resources/csv` - Export resource requests to CSV

**Access**: Admin and NGO users only

## Frontend Performance

### Code Splitting

Use React.lazy for route-based code splitting:

```typescript
import { lazy, Suspense } from "react";

// Lazy load pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Reports = lazy(() => import("./pages/Reports"));
const Analytics = lazy(() => import("./pages/Analytics"));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/reports" component={Reports} />
        <Route path="/analytics" component={Analytics} />
      </Switch>
    </Suspense>
  );
}
```

### Component Memoization

**Location**: `client/src/lib/performance.tsx`

#### memo() for Component Memoization

```typescript
import { memo } from "react";

const ReportCard = memo(({ report }: { report: Report }) => {
  return (
    <div className="report-card">
      <h3>{report.title}</h3>
      <p>{report.description}</p>
    </div>
  );
});
```

#### useMemo for Expensive Calculations

```typescript
import { useMemo } from "react";

function ReportsList({ reports }: { reports: Report[] }) {
  const filteredReports = useMemo(() => {
    return reports.filter(r => r.status === "active");
  }, [reports]);

  const sortedReports = useMemo(() => {
    return [...filteredReports].sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }, [filteredReports]);

  return (
    <div>
      {sortedReports.map(report => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  );
}
```

#### useCallback for Function Memoization

```typescript
import { useCallback } from "react";

function ReportForm() {
  const handleSubmit = useCallback((data: FormData) => {
    // Submit logic
    apiRequest("/api/reports", {
      method: "POST",
      body: data,
    });
  }, []); // Dependencies array

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Performance Hooks

**Location**: `client/src/hooks/usePerformance.ts`

#### useDebounce

Delay processing of rapidly changing values:

```typescript
import { useDebounce } from "@/hooks/usePerformance";

function SearchBox() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    // Only runs 300ms after user stops typing
    fetchResults(debouncedSearch);
  }, [debouncedSearch]);

  return <input onChange={(e) => setSearchTerm(e.target.value)} />;
}
```

#### useThrottle

Limit function execution rate:

```typescript
import { useThrottle } from "@/hooks/usePerformance";

function ScrollTracker() {
  const handleScroll = useThrottle(() => {
    console.log("Scroll position:", window.scrollY);
  }, 100); // Max once per 100ms

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return <div>...</div>;
}
```

#### useLazyLoad

Load items in batches:

```typescript
import { useLazyLoad } from "@/hooks/usePerformance";

function LongList({ items }: { items: Item[] }) {
  const { visibleItems, loadMore, hasMore } = useLazyLoad(items, 20);

  return (
    <div>
      {visibleItems.map(item => (
        <ItemCard key={item.id} item={item} />
      ))}
      {hasMore && <button onClick={loadMore}>Load More</button>}
    </div>
  );
}
```

### React Profiler

**Location**: `client/src/lib/performance.tsx`

Monitor component render performance:

```typescript
import { PerformanceProfiler } from "@/lib/performance";

function MyComponent() {
  return (
    <PerformanceProfiler id="MyComponent">
      <ExpensiveComponent />
    </PerformanceProfiler>
  );
}
```

Access metrics:

```typescript
import { performanceMonitor } from "@/lib/performance";

// Get all metrics
const metrics = performanceMonitor.getMetrics();

// Get slow renders (>16ms)
const slowRenders = performanceMonitor.getSlowRenders(16);

// Get average duration
const avgDuration = performanceMonitor.getAverageDuration("MyComponent");
```

### List Optimization

Always use keys on lists:

```typescript
// ✅ Good
{reports.map(report => (
  <ReportCard key={report.id} report={report} />
))}

// ❌ Bad - Using index as key
{reports.map((report, index) => (
  <ReportCard key={index} report={report} />
))}
```

### Virtual Scrolling

For very long lists (>1000 items), use virtual scrolling:

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });

  return (
    <div ref={parentRef} style={{ height: "500px", overflow: "auto" }}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <ItemCard item={items[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Performance Best Practices

### Backend

1. **Use Indexes** - Add indexes for frequently queried fields
2. **Monitor Slow Queries** - Use query monitoring to identify bottlenecks
3. **Cache Aggressively** - Cache frequently accessed data with appropriate TTLs
4. **Invalidate Smart** - Clear cache only when data actually changes
5. **Stream Large Data** - Use streaming exports for large datasets
6. **Paginate Everything** - Never return unbounded result sets

### Frontend

1. **Code Split Routes** - Use React.lazy for page-level components
2. **Memoize Components** - Use memo() for pure components
3. **Memoize Calculations** - Use useMemo for expensive operations
4. **Memoize Callbacks** - Use useCallback for event handlers
5. **Use Keys Properly** - Always use stable, unique keys on lists
6. **Debounce Inputs** - Debounce search and filter inputs
7. **Throttle Events** - Throttle scroll, resize, and mouse move handlers
8. **Lazy Load Images** - Use lazy loading for images below the fold
9. **Virtual Scroll** - Use virtual scrolling for very long lists
10. **Profile Regularly** - Use React Profiler to identify slow components

## Monitoring Performance

### Backend Metrics

- Query response times
- Cache hit/miss ratio
- Slow query frequency
- API endpoint latency

### Frontend Metrics

- Component render times
- Bundle sizes
- Time to Interactive (TTI)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)

## Tools

### Development

- React DevTools Profiler
- Chrome Performance Tab
- Lighthouse
- Bundle Analyzer

### Production

- Query monitoring dashboard
- Cache statistics endpoint
- Error tracking (Sentry, etc.)
- Performance monitoring (New Relic, Datadog, etc.)

## Summary

Crisis Connect implements comprehensive performance optimizations:

✅ **Database**: Efficient indexes on all frequently queried fields  
✅ **Caching**: In-memory cache with TTL and LRU eviction  
✅ **Monitoring**: Slow query detection and statistics  
✅ **Streaming**: Memory-efficient exports for large datasets  
✅ **Frontend**: Code splitting, memoization, and performance hooks  
✅ **Profiling**: React Profiler integration for render monitoring

For questions or optimization opportunities, refer to the query statistics and performance metrics available through the admin API endpoints.
