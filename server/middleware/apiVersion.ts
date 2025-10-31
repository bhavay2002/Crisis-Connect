import type { Express, Request, Response, NextFunction, Router } from "express";

export interface VersionedRouter {
  v1: Router;
}

export function createVersionedRouter(app: Express): void {
  const API_V1_PREFIX = "/api/v1";

  app.use((req: Request, res: Response, next: NextFunction) => {
    req.apiVersion = "v1";
    next();
  });

  app.get("/api", (req, res) => {
    res.json({
      version: "1.0.0",
      availableVersions: ["v1"],
      documentation: "/api/v1/docs",
    });
  });
}

declare global {
  namespace Express {
    interface Request {
      apiVersion?: string;
    }
  }
}
