import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { fromZodError } from "zod-validation-error";
import { AppError } from "../errors/AppError";
import { logger } from "../utils/logger";

/**
 * Standardized error response interface
 */
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: unknown;
    stack?: string;
  };
}

/**
 * Global error handling middleware
 * Converts all errors to a standardized format
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Handle Zod validation errors
  if (err.name === "ZodError") {
    const validationError = fromZodError(err as any);
    const response: ErrorResponse = {
      success: false,
      error: {
        message: validationError.message,
        code: "VALIDATION_ERROR",
        statusCode: 422,
        details: (err as any).issues || undefined,
      },
    };
    
    res.status(422).json(response);
    logError(err, req);
    return;
  }

  // Handle custom AppError instances
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        details: err.details,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
      },
    };

    res.status(err.statusCode).json(response);
    logError(err, req, err.isOperational);
    return;
  }

  // Handle generic errors (unhandled/unexpected)
  const response: ErrorResponse = {
    success: false,
    error: {
      message: process.env.NODE_ENV === "development" 
        ? err.message 
        : "An unexpected error occurred",
      code: "INTERNAL_ERROR",
      statusCode: 500,
      ...(process.env.NODE_ENV === "development" && { 
        stack: err.stack,
        details: err,
      }),
    },
  };

  res.status(500).json(response);
  logError(err, req, false);
};

/**
 * Log errors with context using structured logger
 */
function logError(err: Error, req: Request, isOperational: boolean = true): void {
  const context = {
    name: err.name,
    isOperational,
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: (req as any).user?.claims?.sub,
    },
  };

  if (isOperational) {
    logger.error(`Operational Error: ${err.message}`, err, context);
  } else {
    logger.error(`🚨 CRITICAL ERROR: ${err.message}`, err, { ...context, critical: true });
    // In production, this could trigger alerts, monitoring, etc.
  }
}

/**
 * Async route handler wrapper
 * Automatically catches errors and passes to error handler
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 * Should be registered after all routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ErrorResponse = {
    success: false,
    error: {
      message: `Route ${req.method} ${req.url} not found`,
      code: "ROUTE_NOT_FOUND",
      statusCode: 404,
    },
  };
  
  res.status(404).json(response);
}
