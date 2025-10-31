import { logger } from "./logger";

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  params?: any[];
}

class QueryMonitor {
  private slowQueryThreshold: number = 1000; // 1 second
  private queries: QueryMetrics[] = [];
  private maxStoredQueries: number = 100;

  setSlowQueryThreshold(ms: number): void {
    this.slowQueryThreshold = ms;
  }

  logQuery(query: string, duration: number, params?: any[]): void {
    const metrics: QueryMetrics = {
      query,
      duration,
      timestamp: new Date(),
      params,
    };

    // Store query metrics
    this.queries.unshift(metrics);
    if (this.queries.length > this.maxStoredQueries) {
      this.queries.pop();
    }

    // Log slow queries
    if (duration > this.slowQueryThreshold) {
      logger.warn("Slow query detected", {
        query,
        duration: `${duration}ms`,
        threshold: `${this.slowQueryThreshold}ms`,
        params,
      });
    }
  }

  wrapQuery<T>(
    queryFn: () => Promise<T>,
    queryName: string,
    params?: any[]
  ): Promise<T> {
    const startTime = Date.now();

    return queryFn()
      .then((result) => {
        const duration = Date.now() - startTime;
        this.logQuery(queryName, duration, params);
        return result;
      })
      .catch((error) => {
        const duration = Date.now() - startTime;
        this.logQuery(queryName, duration, params);
        logger.error("Query failed", error as Error, {
          queryName,
          duration: `${duration}ms`,
          params,
        });
        throw error;
      });
  }

  getSlowQueries(minDuration?: number): QueryMetrics[] {
    const threshold = minDuration || this.slowQueryThreshold;
    return this.queries.filter((q) => q.duration > threshold);
  }

  getQueryStats(): {
    total: number;
    slow: number;
    avgDuration: number;
    maxDuration: number;
    slowQueryThreshold: number;
  } {
    if (this.queries.length === 0) {
      return {
        total: 0,
        slow: 0,
        avgDuration: 0,
        maxDuration: 0,
        slowQueryThreshold: this.slowQueryThreshold,
      };
    }

    const total = this.queries.length;
    const slow = this.queries.filter((q) => q.duration > this.slowQueryThreshold).length;
    const avgDuration = this.queries.reduce((sum, q) => sum + q.duration, 0) / total;
    const maxDuration = Math.max(...this.queries.map((q) => q.duration));

    return {
      total,
      slow,
      avgDuration: Math.round(avgDuration * 100) / 100,
      maxDuration,
      slowQueryThreshold: this.slowQueryThreshold,
    };
  }

  getRecentQueries(count: number = 10): QueryMetrics[] {
    return this.queries.slice(0, count);
  }

  clear(): void {
    this.queries = [];
  }
}

export const queryMonitor = new QueryMonitor();

export function withQueryMonitoring<T>(
  queryFn: () => Promise<T>,
  queryName: string,
  params?: any[]
): Promise<T> {
  return queryMonitor.wrapQuery(queryFn, queryName, params);
}
