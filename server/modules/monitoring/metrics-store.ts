export interface RequestMetric {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
}

interface Counter { [key: string]: number }
interface Histogram { count: number; sum: number; buckets: Record<string, number> }

class MetricsStore {
  private static instance: MetricsStore;
  private requestCount: Counter = {};
  private errorCount: Counter = {};
  private histograms: Record<string, Histogram> = {};
  private activeConnections = 0;
  private startTime = Date.now();
  private recentRequests: RequestMetric[] = [];
  private readonly maxRecent = 1000;

  static getInstance(): MetricsStore {
    if (!MetricsStore.instance) MetricsStore.instance = new MetricsStore();
    return MetricsStore.instance;
  }

  record(metric: RequestMetric) {
    const key = `${metric.method}_${metric.route}_${metric.statusCode}`;
    this.requestCount[key] = (this.requestCount[key] || 0) + 1;

    if (metric.statusCode >= 400) {
      const errKey = `${metric.route}_${metric.statusCode}`;
      this.errorCount[errKey] = (this.errorCount[errKey] || 0) + 1;
    }

    const histKey = `http_response_time_ms`;
    if (!this.histograms[histKey]) {
      this.histograms[histKey] = { count: 0, sum: 0, buckets: { "50": 0, "100": 0, "250": 0, "500": 0, "1000": 0, "+Inf": 0 } };
    }
    const h = this.histograms[histKey];
    h.count++;
    h.sum += metric.durationMs;
    for (const bucket of Object.keys(h.buckets)) {
      if (bucket === "+Inf" || metric.durationMs <= parseInt(bucket)) {
        h.buckets[bucket]++;
      }
    }

    this.recentRequests.push(metric);
    if (this.recentRequests.length > this.maxRecent) {
      this.recentRequests.shift();
    }
  }

  setActiveConnections(count: number) { this.activeConnections = count; }

  getTotalRequests(): number {
    return Object.values(this.requestCount).reduce((a, b) => a + b, 0);
  }

  getErrorRate(): number {
    const total = this.getTotalRequests();
    const errors = Object.values(this.errorCount).reduce((a, b) => a + b, 0);
    return total > 0 ? (errors / total) * 100 : 0;
  }

  getAvgResponseTime(): number {
    const h = this.histograms["http_response_time_ms"];
    if (!h || h.count === 0) return 0;
    return Math.round(h.sum / h.count);
  }

  getP95ResponseTime(): number {
    const h = this.histograms["http_response_time_ms"];
    if (!h || h.count === 0) return 0;
    const p95count = Math.ceil(h.count * 0.95);
    const buckets = [50, 100, 250, 500, 1000];
    let cumulative = 0;
    for (const b of buckets) {
      cumulative += h.buckets[String(b)] || 0;
      if (cumulative >= p95count) return b;
    }
    return h.buckets["+Inf"] > 0 ? Math.round(h.sum / h.count) : 1000;
  }

  getRecentRequestRate(windowMs = 60_000): number {
    const cutoff = Date.now() - windowMs;
    return this.recentRequests.filter(r => r.timestamp >= cutoff).length;
  }

  toPrometheus(): string {
    const lines: string[] = [];
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    lines.push("# HELP http_requests_total Total HTTP requests");
    lines.push("# TYPE http_requests_total counter");
    for (const [key, count] of Object.entries(this.requestCount)) {
      const [method, ...rest] = key.split("_");
      const status = rest[rest.length - 1];
      const route = rest.slice(0, -1).join("_");
      lines.push(`http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`);
    }

    lines.push("# HELP http_errors_total Total HTTP errors");
    lines.push("# TYPE http_errors_total counter");
    for (const [key, count] of Object.entries(this.errorCount)) {
      lines.push(`http_errors_total{route="${key}"} ${count}`);
    }

    const h = this.histograms["http_response_time_ms"];
    if (h) {
      lines.push("# HELP http_response_time_ms HTTP response time in milliseconds");
      lines.push("# TYPE http_response_time_ms histogram");
      for (const [le, count] of Object.entries(h.buckets)) {
        lines.push(`http_response_time_ms_bucket{le="${le}"} ${count}`);
      }
      lines.push(`http_response_time_ms_sum ${h.sum}`);
      lines.push(`http_response_time_ms_count ${h.count}`);
    }

    lines.push("# HELP process_uptime_seconds Process uptime in seconds");
    lines.push("# TYPE process_uptime_seconds gauge");
    lines.push(`process_uptime_seconds ${uptime}`);

    lines.push("# HELP active_connections Current active connections");
    lines.push("# TYPE active_connections gauge");
    lines.push(`active_connections ${this.activeConnections}`);

    lines.push("# HELP requests_per_minute Request rate per last minute");
    lines.push("# TYPE requests_per_minute gauge");
    lines.push(`requests_per_minute ${this.getRecentRequestRate()}`);

    return lines.join("\n") + "\n";
  }

  getSummary() {
    return {
      totalRequests: this.getTotalRequests(),
      errorRate: parseFloat(this.getErrorRate().toFixed(2)),
      avgResponseTimeMs: this.getAvgResponseTime(),
      p95ResponseTimeMs: this.getP95ResponseTime(),
      requestsPerMinute: this.getRecentRequestRate(),
      activeConnections: this.activeConnections,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}

export const metricsStore = MetricsStore.getInstance();
