import { logger } from "../utils/logger";

interface ConnectionAttempt {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

export class WebSocketRateLimiter {
  private attempts: Map<string, ConnectionAttempt> = new Map();
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(windowMs: number = 60000, maxAttempts: number = 10) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;

    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const attempt = this.attempts.get(identifier);

    if (!attempt) {
      this.attempts.set(identifier, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return true;
    }

    // Check if we're outside the window
    if (now - attempt.firstAttempt > this.windowMs) {
      // Reset the window
      this.attempts.set(identifier, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return true;
    }

    // Within the window
    attempt.count++;
    attempt.lastAttempt = now;

    if (attempt.count > this.maxAttempts) {
      logger.warn("WebSocket rate limit exceeded", {
        identifier,
        attempts: attempt.count,
        windowMs: this.windowMs,
      });
      return false;
    }

    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    const staleIdentifiers: string[] = [];

    for (const [identifier, attempt] of Array.from(this.attempts.entries())) {
      if (now - attempt.lastAttempt > this.windowMs * 2) {
        staleIdentifiers.push(identifier);
      }
    }

    for (const identifier of staleIdentifiers) {
      this.attempts.delete(identifier);
    }

    if (staleIdentifiers.length > 0) {
      logger.debug("WebSocket rate limiter cleanup", {
        removed: staleIdentifiers.length,
      });
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.attempts.clear();
  }
}

export const wsRateLimiter = new WebSocketRateLimiter(60000, 10);
