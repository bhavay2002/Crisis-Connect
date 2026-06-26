import type { Express } from "express";
import { storage } from "../db/storage";
import { isAuthenticated } from "../middleware/jwtAuth";
import { authLimiter } from "../middleware/rateLimiting";
import { AuditLogger } from "../middleware/auditLog";
import { logger } from "../utils/logger";

export function registerAuthRoutes(app: Express) {
  // Get current authenticated user (legacy endpoint — /api/auth/me is canonical)
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Never expose password hash or raw refresh token
      const { password: _, refreshToken: __, ...userWithoutSensitiveFields } = user;
      res.json(userWithoutSensitiveFields);
    } catch (error) {
      logger.error("Error fetching user", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get assignable users (for NGO/admin)
  app.get("/api/admin/assignable-users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin and NGO users can access assignable users list
      if (!user.role || !["ngo", "admin"].includes(user.role)) {
        return res.status(403).json({ 
          message: "Only NGOs and admins can access assignable users" 
        });
      }

      const users = await storage.getAssignableUsers();
      res.json(users);
    } catch (error) {
      logger.error("Error fetching assignable users", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to fetch assignable users" });
    }
  });

  // Get all users (admin only)
  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin users can access all users list
      if (user.role !== "admin") {
        return res.status(403).json({ 
          message: "Only admins can access all users" 
        });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      logger.error("Error fetching all users", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to fetch all users" });
    }
  });

  // Update any user's role (admin only)
  app.post("/api/admin/users/:userId/role", isAuthenticated, authLimiter, async (req: any, res) => {
    try {
      const currentUserId = req.user.userId;
      const { userId } = req.params;
      const { role } = req.body;
      
      // Validate role — must match the full set recognised by the system
      const validRoles = ["citizen", "volunteer", "ngo", "admin", "government", "authority", "super_admin"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role", validRoles });
      }
      
      // Get current user
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser) {
        return res.status(404).json({ message: "Current user not found" });
      }
      
      // Only super_admin, authority, or admin can update other users' roles
      const adminRoles = ["admin", "authority", "super_admin"];
      if (!adminRoles.includes(currentUser.role || "")) {
        return res.status(403).json({ 
          message: "Forbidden: Only admins can update user roles" 
        });
      }

      // Only super_admin can assign authority/super_admin
      const elevatedRoles = ["authority", "super_admin"];
      if (elevatedRoles.includes(role) && currentUser.role !== "super_admin") {
        return res.status(403).json({
          message: "Forbidden: Only super_admin can assign authority or super_admin roles"
        });
      }

      // Get target user
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }
      
      // Prevent admins from demoting themselves
      if (currentUserId === userId && currentUser.role === "admin" && role !== "admin") {
        return res.status(403).json({ 
          message: "Forbidden: Admins cannot demote themselves. Contact another admin." 
        });
      }
      
      const oldRole = targetUser.role || "citizen";
      const updatedUser = await storage.updateUserRole(userId, role);
      
      await AuditLogger.logRoleUpdate(currentUserId, userId, oldRole, role, req);
      
      res.json(updatedUser);
    } catch (error) {
      logger.error("Error updating user role", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Update user role
  app.post("/api/auth/update-role", isAuthenticated, authLimiter, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { role } = req.body;
      
      // Validate role — must match the full set recognised by the system
      const validRoles = ["citizen", "volunteer", "ngo", "admin", "government", "authority", "super_admin"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role", validRoles });
      }
      
      // Get current user
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Security: Only admins/authority/super_admin can assign elevated roles
      const adminRoles = ["admin", "authority", "super_admin"];
      if (adminRoles.includes(role) && !adminRoles.includes(currentUser.role || "")) {
        return res.status(403).json({ 
          message: "Forbidden: Only admins can assign elevated roles" 
        });
      }
      
      // Prevent admins from accidentally demoting themselves
      if (adminRoles.includes(currentUser.role || "") && !adminRoles.includes(role)) {
        return res.status(403).json({ 
          message: "Forbidden: Admins cannot demote themselves. Contact another admin." 
        });
      }
      
      const oldRole = currentUser.role || "citizen";
      const user = await storage.updateUserRole(userId, role);
      
      await AuditLogger.logRoleUpdate(userId, userId, oldRole, role, req);
      
      res.json(user);
    } catch (error) {
      logger.error("Error updating role", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // Get current user's verifications
  app.get("/api/verifications/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const verifications = await storage.getUserVerifications(userId);
      res.json(verifications);
    } catch (error) {
      logger.error("Error fetching verifications", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to fetch verifications" });
    }
  });

  // User reputation routes
  // IMPORTANT: Specific routes must come before parameterized routes in Express
  app.get("/api/reputation/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      let reputation = await storage.getUserReputation(userId);
      
      if (!reputation) {
        reputation = await storage.createUserReputation({ userId });
      }
      
      res.json(reputation);
    } catch (error) {
      logger.error("Error fetching user reputation", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to fetch user reputation" });
    }
  });

  app.get("/api/reputation/:userId", async (req, res) => {
    try {
      const reputation = await storage.getUserReputation(req.params.userId);
      
      if (!reputation) {
        const newReputation = await storage.createUserReputation({ 
          userId: req.params.userId 
        });
        return res.json(newReputation);
      }
      
      res.json(reputation);
    } catch (error) {
      logger.error("Error fetching user reputation", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to fetch user reputation" });
    }
  });
}
