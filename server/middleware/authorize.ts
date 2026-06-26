import type { RequestHandler } from "express";
import { can, type Action } from "../config/permissions";
import { logger } from "../utils/logger";

export function authorize(action: Action): RequestHandler {
  return (req: any, res, next) => {
    const role = req.user?.role;
    if (!role) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!can(role, action)) {
      logger.warn(`Authorization denied`, { userId: req.user?.userId, role, action });
      return res.status(403).json({
        message: "Forbidden: Insufficient permissions",
        action,
        role,
      });
    }
    next();
  };
}
