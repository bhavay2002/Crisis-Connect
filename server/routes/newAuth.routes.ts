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

        // Set refresh token as httpOnly cookie — not accessible to JS
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: "/api/auth",
        });

        res.status(201).json({
          message: "User registered successfully",
          user: userWithoutPassword,
          accessToken,
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

        const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
        storage.upsertDeviceFingerprint({ userId: user.id, ipAddress: ip, userAgent: req.headers["user-agent"] }).catch(() => {});

        logger.info("User logged in successfully", { userId: user.id, email });

        const { password: _, refreshToken: __, ...userWithoutPassword } = user;

        // Set refresh token as httpOnly cookie — not accessible to JS
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: "/api/auth",
        });

        res.json({
          message: "Login successful",
          user: userWithoutPassword,
          accessToken,
        });
      } catch (error) {
        logger.error("Login failed", error instanceof Error ? error : undefined);
        res.status(500).json({ message: "Login failed" });
      }
    }
  );

  app.post("/api/auth/refresh", async (req, res) => {
    try {
      // Prefer the httpOnly cookie; fall back to body for legacy clients
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

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

      // Rotate the httpOnly cookie with the new refresh token
      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/api/auth",
      });

      logger.info("Token refreshed", { userId: user.id });

      res.json({ accessToken });
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

      // Clear the httpOnly refresh token cookie
      res.clearCookie("refreshToken", { path: "/api/auth" });

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
