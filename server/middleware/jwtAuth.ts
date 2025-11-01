import type { RequestHandler } from "express";
import { verifyAccessToken } from "../utils/jwtUtils";
import { logger } from "../utils/logger";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

export const authenticateToken: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Access token required" });
    }

    const payload = verifyAccessToken(token);
    
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    logger.warn("Authentication failed", error instanceof Error ? error : undefined);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

export const isAuthenticated = authenticateToken;
