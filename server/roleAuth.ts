import type { RequestHandler } from "express";
import { storage } from "./storage";

export type UserRole = "citizen" | "volunteer" | "ngo" | "admin";

// Middleware to check if user has required role
export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return async (req: any, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user || !req.user.claims) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has one of the allowed roles
      if (!allowedRoles.includes(user.role as UserRole)) {
        return res.status(403).json({
          message: "Forbidden: Insufficient permissions",
          required: allowedRoles,
          current: user.role,
        });
      }

      // Attach user to request for use in route handlers
      req.dbUser = user;
      next();
    } catch (error) {
      console.error("Error checking user role:", error);
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
