import type { RequestHandler } from "express";
import { storage } from "../db/storage";
import { logger } from "../utils/logger";

export type UserRole = "citizen" | "volunteer" | "ngo" | "admin";

// Middleware to check if user has required role
export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return async (req: any, res, next) => {
    try {
      // Check if user is authenticated (JWT auth sets req.user with userId, email, role)
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = req.user.userId;
      const userRole = req.user.role;

      // Check if user has one of the allowed roles (from JWT payload)
      if (!allowedRoles.includes(userRole as UserRole)) {
        return res.status(403).json({
          message: "Forbidden: Insufficient permissions",
          required: allowedRoles,
          current: userRole,
        });
      }

      // Optionally fetch full user data if needed
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Attach user to request for use in route handlers
      req.dbUser = user;
      next();
    } catch (error) {
      logger.error("Error checking user role", error instanceof Error ? error : undefined, { 
        userId: req.user?.userId,
        allowedRoles 
      });
      res.status(500).json({ message: "Internal server error" });
    }
  };
}

// Middleware to check if user is admin
export const requireAdmin = requireRole("admin");

// Middleware to check if user is volunteer or higher
export const requireVolunteer = requireRole("volunteer", "ngo", "admin");

// Middleware to check if user is NGO or admin
export const requireNGO = requireRole("ngo", "admin");

// Helper function to check role programmatically
export async function hasRole(
  userId: string,
  ...allowedRoles: UserRole[]
): Promise<boolean> {
  const user = await storage.getUser(userId);
  if (!user) return false;
  return allowedRoles.includes(user.role as UserRole);
}
