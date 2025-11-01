import type { RequestHandler } from "express";
import { z } from "zod";
import { validateSchema, getUserId } from "../utils/validation";
import { ValidationError, UnauthorizedError } from "../errors/AppError";
import { storage } from "../db/storage";
import { logger } from "../utils/logger";

export function validateBody<T extends z.ZodType>(schema: T): RequestHandler {
  return (req, res, next) => {
    try {
      req.body = validateSchema(schema, req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateQuery<T extends z.ZodType>(schema: T): RequestHandler {
  return (req, res, next) => {
    try {
      req.query = validateSchema(schema, req.query);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateParams<T extends z.ZodType>(schema: T): RequestHandler {
  return (req, res, next) => {
    try {
      req.params = validateSchema(schema, req.params);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireAuth: RequestHandler = (req: any, res, next) => {
  if (!req.user || !req.user.userId) {
    logger.warn(`Authentication required but not provided`, { 
      path: req.path,
      method: req.method 
    });
    return next(new UnauthorizedError("Authentication required"));
  }
  next();
};

export const requireVerifiedIdentity: RequestHandler = async (req: any, res, next) => {
  try {
    if (!req.user?.userId) {
      return next(new UnauthorizedError("Authentication required"));
    }

    const userId = req.user.userId;
    const user = await storage.getUser(userId);

    if (!user) {
      return next(new ValidationError("User not found"));
    }

    if (!user.identityVerifiedAt) {
      logger.warn(`Identity verification required`, { userId, path: req.path });
      return res.status(403).json({
        message: "Identity verification required",
        verified: false
      });
    }

    req.dbUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const requirePhoneVerification: RequestHandler = async (req: any, res, next) => {
  try {
    if (!req.user?.userId) {
      return next(new UnauthorizedError("Authentication required"));
    }

    const userId = req.user.userId;
    const user = await storage.getUser(userId);

    if (!user) {
      return next(new ValidationError("User not found"));
    }

    if (!user.phoneVerified) {
      logger.warn(`Phone verification required`, { userId, path: req.path });
      return res.status(403).json({
        message: "Phone verification required",
        verified: false
      });
    }

    req.dbUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireEmailVerification: RequestHandler = async (req: any, res, next) => {
  try {
    if (!req.user?.userId) {
      return next(new UnauthorizedError("Authentication required"));
    }

    const userId = req.user.userId;
    const user = await storage.getUser(userId);

    if (!user) {
      return next(new ValidationError("User not found"));
    }

    if (!user.emailVerified) {
      logger.warn(`Email verification required`, { userId, path: req.path });
      return res.status(403).json({
        message: "Email verification required",
        verified: false
      });
    }

    req.dbUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

export function checkOwnership(
  getResourceOwnerId: (req: any) => Promise<string>
): RequestHandler {
  return async (req: any, res, next) => {
    try {
      const userId = getUserId(req);
      const ownerId = await getResourceOwnerId(req);

      if (userId !== ownerId) {
        logger.warn(`Ownership check failed`, { 
          userId, 
          ownerId, 
          resource: req.path 
        });
        return res.status(403).json({
          message: "You don't have permission to access this resource"
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
