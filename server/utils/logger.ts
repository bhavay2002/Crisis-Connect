import { config } from "../config";

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Log entry interface
 */
interface LogEntry {
  level: keyof typeof LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
}

/**
 * Logger class for structured logging
 */
class Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Format log entry
   */
  private format(entry: LogEntry): string {
    const { level, message, timestamp, context, error } = entry;
    
    const parts = [
      `[${timestamp}]`,
      this.getLevelIcon(level),
      `[${level}]`,
      message,
    ];

    if (context && Object.keys(context).length > 0) {
      parts.push(`\n  Context: ${JSON.stringify(context, null, 2)}`);
    }

    if (error) {
      parts.push(`\n  Error: ${error.message}`);
      if (config.isDevelopment && error.stack) {
        parts.push(`\n  Stack: ${error.stack}`);
      }
    }

    return parts.join(" ");
  }

  /**
   * Get emoji icon for log level
   */
  private getLevelIcon(level: keyof typeof LogLevel): string {
    const icons = {
      DEBUG: "🔍",
      INFO: "ℹ️",
      WARN: "⚠️",
      ERROR: "❌",
    };
    return icons[level];
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const entry: LogEntry = {
      level: "DEBUG",
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    console.log(this.format(entry));
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry: LogEntry = {
      level: "INFO",
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    console.log(this.format(entry));
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const entry: LogEntry = {
      level: "WARN",
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    console.warn(this.format(entry));
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const entry: LogEntry = {
      level: "ERROR",
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
    };

    console.error(this.format(entry));
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, additionalContext);
  }
}

/**
 * Child logger with inherited context
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, unknown>
  ) {}

  private mergeContext(context?: Record<string, unknown>): Record<string, unknown> {
    return { ...this.context, ...context };
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.parent.error(message, error, this.mergeContext(context));
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger(
  config.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO
);

/**
 * Request logger middleware
 */
export function requestLogger(req: any, res: any, next: any): void {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.url} ${res.statusCode}`;
    const context = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.claims?.sub,
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      logger.error(message, undefined, context);
    } else if (res.statusCode >= 400) {
      logger.warn(message, context);
    } else {
      logger.info(message, context);
    }
  });

  next();
}
