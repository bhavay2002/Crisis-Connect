import type { Express, Request, Response } from "express";
import { storage } from "../db/storage";
import { authenticateToken } from "../middleware/jwtAuth";
import { authLimiter } from "../middleware/rateLimiting";
import { AuditLogger } from "../middleware/auditLog";
import { hashPassword, comparePassword, validatePasswordStrength } from "../utils/passwordUtils";
import { generateTokenPair, verifyRefreshToken } from "../utils/jwtUtils";
import { logger } from "../utils/logger";
import { body, validationResult } from "express-validator";

export function registerNewAuthRoutes(app: Express) {
  app.post(
    "/api/auth/register",
    authLimiter,
    [
      body("email").isEmail().normalizeEmail(),
      body("password").isLength({ min: 8 }),
      body("name").trim().isLength({ min: 1 }),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ 
            message: "Validation failed", 
            errors: errors.array() 
          });
        }

        const { email, password, name } = req.body;

        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
          return res.status(400).json({ message: passwordValidation.message });
        }

        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(409).json({ message: "User already exists" });
        }

        const hashedPassword = await hashPassword(password);

        const user = await storage.createUser({
          email,
          password: hashedPassword,
          name,
          role: "citizen",
          refreshToken: null,
        });

        const { accessToken, refreshToken } = generateTokenPair(user);
        
        await storage.updateUserRefreshToken(user.id, refreshToken);

        await AuditLogger.logUserRegistration(user.id, req);

        logger.info("User registered successfully", { userId: user.id, email });

        const { password: _, refreshToken: __, ...userWithoutPassword } = user;

        res.status(201).json({
          message: "User registered successfully",
          user: userWithoutPassword,
          accessToken,
          refreshToken,
        });
      } catch (error) {
        logger.error("Registration failed", error instanceof Error ? error : undefined);
        res.status(500).json({ message: "Registration failed" });
      }
    }
  );

  app.post(
    "/api/auth/login",
    authLimiter,
    [
      body("email").isEmail().normalizeEmail(),
      body("password").exists(),
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ 
            message: "Validation failed", 
            errors: errors.array() 
          });
        }

        const { email, password } = req.body;

        const user = await storage.getUserByEmail(email);
        if (!user) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
          await AuditLogger.logFailedLogin(email, req);
          return res.status(401).json({ message: "Invalid credentials" });
        }

        const { accessToken, refreshToken } = generateTokenPair(user);

        await storage.updateUserRefreshToken(user.id, refreshToken);

        await AuditLogger.logSuccessfulLogin(user.id, req);

        logger.info("User logged in successfully", { userId: user.id, email });

        const { password: _, refreshToken: __, ...userWithoutPassword } = user;

        res.json({
          message: "Login successful",
          user: userWithoutPassword,
          accessToken,
          refreshToken,
        });
      } catch (error) {
        logger.error("Login failed", error instanceof Error ? error : undefined);
        res.status(500).json({ message: "Login failed" });
      }
    }
  );

  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token required" });
      }

      const payload = verifyRefreshToken(refreshToken);

      const user = await storage.getUser(payload.userId);
      if (!user || user.refreshToken !== refreshToken) {
        return res.status(403).json({ message: "Invalid refresh token" });
      }

      const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(user);

      await storage.updateUserRefreshToken(user.id, newRefreshToken);

      logger.info("Token refreshed", { userId: user.id });

      res.json({
        accessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      logger.error("Token refresh failed", error instanceof Error ? error : undefined);
      res.status(403).json({ message: "Invalid or expired refresh token" });
    }
  });

  app.post("/api/auth/logout", authenticateToken, async (req, res) => {
    try {
      const userId = req.user!.userId;

      await storage.updateUserRefreshToken(userId, null);

      await AuditLogger.logUserLogout(userId, req);

      logger.info("User logged out", { userId });

      res.json({ message: "Logged out successfully" });
    } catch (error) {
      logger.error("Logout failed", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  app.get("/api/auth/user", authenticateToken, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, refreshToken: __, ...userWithoutPassword } = user;
      
      res.json(userWithoutPassword);
    } catch (error) {
      logger.error("Error fetching user", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, refreshToken: __, ...userWithoutPassword } = user;
      
      res.json(userWithoutPassword);
    } catch (error) {
      logger.error("Error fetching user", error instanceof Error ? error : undefined);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
