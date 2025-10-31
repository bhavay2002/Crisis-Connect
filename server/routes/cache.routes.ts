import type { Express } from "express";
import { cache } from "../utils/cache";
import { isAuthenticated } from "../auth/replitAuth";
import { logger } from "../utils/logger";

/**
 * Cache management and statistics API routes
 * Provides insights into cache performance and manual cache control
 */
export function registerCacheRoutes(app: Express) {
  // Get cache statistics
  app.get("/api/cache/stats", isAuthenticated, (req, res) => {
    try {
      const stats = cache.getStats();
      const hitRate = cache.getHitRate();
      
      res.json({
        ...stats,
        hitRate: hitRate.toFixed(2) + '%',
      });
    } catch (error) {
      logger.error("Error fetching cache stats", error as Error);
      res.status(500).json({ message: "Failed to fetch cache statistics" });
    }
  });

  // Clear all cache (admin only)
  app.post("/api/cache/clear", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { storage } = await import("../db/storage");
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      cache.clear();
      logger.info("Cache cleared by admin", { userId });
      
      res.json({ message: "Cache cleared successfully" });
    } catch (error) {
      logger.error("Error clearing cache", error as Error);
      res.status(500).json({ message: "Failed to clear cache" });
    }
  });

  // Clear specific cache pattern (admin only)
  app.post("/api/cache/clear/:pattern", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { storage } = await import("../db/storage");
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { pattern } = req.params;
      const deleted = cache.deletePattern(new RegExp(pattern));
      
      logger.info("Cache pattern cleared by admin", { userId, pattern, deleted });
      
      res.json({ 
        message: `Cleared ${deleted} cache entries matching pattern`,
        deleted 
      });
    } catch (error) {
      logger.error("Error clearing cache pattern", error as Error);
      res.status(500).json({ message: "Failed to clear cache pattern" });
    }
  });
}
