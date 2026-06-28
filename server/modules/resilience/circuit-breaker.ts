import { logger } from "../../utils/logger";

type CBState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
}

export class CircuitBreaker {
  private state: CBState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureAt: number | null = null;
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;

  constructor(opts: CircuitBreakerOptions) {
    this.name = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.successThreshold = opts.successThreshold ?? 2;
    this.timeout = opts.timeout ?? 30_000;
  }

  async execute<T>(fn: () => Promise<T>, fallback?: () => T | Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - (this.lastFailureAt ?? 0) > this.timeout) {
        this.state = "HALF_OPEN";
        logger.info(`[CircuitBreaker:${this.name}] → HALF_OPEN`);
      } else {
        logger.warn(`[CircuitBreaker:${this.name}] OPEN — using fallback`);
        if (fallback) return await fallback();
        throw new Error(`Circuit breaker OPEN for ${this.name}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      if (fallback) {
        logger.warn(`[CircuitBreaker:${this.name}] failed — fallback used`);
        return await fallback();
      }
      throw err;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = "CLOSED";
        this.successCount = 0;
        logger.info(`[CircuitBreaker:${this.name}] → CLOSED`);
      }
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureAt = Date.now();
    if (this.state === "HALF_OPEN" || this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      logger.warn(`[CircuitBreaker:${this.name}] → OPEN (failures: ${this.failureCount})`);
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureAt: this.lastFailureAt,
    };
  }
}

export const circuitBreakers: Record<string, CircuitBreaker> = {};

export function getCircuitBreaker(name: string, opts?: Partial<CircuitBreakerOptions>): CircuitBreaker {
  if (!circuitBreakers[name]) {
    circuitBreakers[name] = new CircuitBreaker({ name, ...opts });
  }
  return circuitBreakers[name];
}
