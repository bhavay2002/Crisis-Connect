import { logger } from "../../utils/logger";

interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  onRetry?: (attempt: number, err: Error) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 200,
    maxDelayMs = 10_000,
    factor = 2,
    onRetry,
  } = opts;

  let lastErr: Error = new Error("Unknown error");
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < attempts) {
        const delay = Math.min(baseDelayMs * Math.pow(factor, attempt - 1), maxDelayMs);
        const jitter = Math.random() * delay * 0.2;
        const wait = Math.round(delay + jitter);
        logger.warn(`[Retry] attempt ${attempt}/${attempts} failed — retrying in ${wait}ms`, { error: lastErr.message });
        if (onRetry) onRetry(attempt, lastErr);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}
