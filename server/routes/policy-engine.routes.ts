import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { requireRole } from "../middleware/roleAuth";
import { policyEngine } from "../modules/policy/policy-engine.service";
import { db } from "../db/db";
import { policyRules, policyRuleLogs } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "../utils/logger";

const adminRoles = ["admin", "authority", "super_admin"] as const;

export function registerPolicyEngineRoutes(app: Express) {
  // Seed defaults on startup
  policyEngine.seedDefaultRules().catch(() => {});

  // List all rules
  app.get("/api/policy-engine/rules", isAuthenticated, async (_req, res) => {
    try {
      const rules = await db.select().from(policyRules).orderBy(desc(policyRules.priority));
      res.json({ rules, count: rules.length });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch rules" });
    }
  });

  // Get single rule
  app.get("/api/policy-engine/rules/:id", isAuthenticated, async (req, res) => {
    try {
      const [rule] = await db.select().from(policyRules).where(eq(policyRules.id, req.params.id));
      if (!rule) return res.status(404).json({ message: "Rule not found" });
      res.json(rule);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch rule" });
    }
  });

  // Create rule
  app.post("/api/policy-engine/rules", isAuthenticated, requireRole(...adminRoles), async (req: any, res) => {
    try {
      const { name, description, conditions, logicalOperator, actions, enabled, priority } = req.body;
      if (!name || !conditions?.length || !actions?.length) {
        return res.status(400).json({ message: "name, conditions, and actions are required" });
      }
      const [rule] = await db.insert(policyRules).values({
        name, description, conditions, logicalOperator: logicalOperator ?? "AND",
        actions, enabled: enabled ?? true, priority: priority ?? 0,
        createdBy: req.user.userId,
      } as any).returning();
      logger.info("[PolicyEngine] Rule created", { ruleId: rule.id, name, by: req.user.userId });
      res.status(201).json(rule);
    } catch (err) {
      res.status(500).json({ message: "Failed to create rule" });
    }
  });

  // Update rule
  app.patch("/api/policy-engine/rules/:id", isAuthenticated, requireRole(...adminRoles), async (req: any, res) => {
    try {
      const { name, description, conditions, logicalOperator, actions, enabled, priority } = req.body;
      const [updated] = await db.update(policyRules).set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(conditions !== undefined && { conditions }),
        ...(logicalOperator !== undefined && { logicalOperator }),
        ...(actions !== undefined && { actions }),
        ...(enabled !== undefined && { enabled }),
        ...(priority !== undefined && { priority }),
        updatedAt: new Date(),
      }).where(eq(policyRules.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ message: "Rule not found" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update rule" });
    }
  });

  // Toggle enable/disable
  app.patch("/api/policy-engine/rules/:id/toggle", isAuthenticated, requireRole(...adminRoles), async (req, res) => {
    try {
      const [rule] = await db.select().from(policyRules).where(eq(policyRules.id, req.params.id));
      if (!rule) return res.status(404).json({ message: "Rule not found" });
      const [updated] = await db.update(policyRules).set({
        enabled: !rule.enabled, updatedAt: new Date(),
      }).where(eq(policyRules.id, req.params.id)).returning();
      res.json({ id: updated.id, enabled: updated.enabled });
    } catch (err) {
      res.status(500).json({ message: "Failed to toggle rule" });
    }
  });

  // Delete rule
  app.delete("/api/policy-engine/rules/:id", isAuthenticated, requireRole(...adminRoles), async (req, res) => {
    try {
      await db.delete(policyRules).where(eq(policyRules.id, req.params.id));
      res.json({ message: "Rule deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete rule" });
    }
  });

  // Test a rule against a context (without saving)
  app.post("/api/policy-engine/test", isAuthenticated, requireRole(...adminRoles), async (req, res) => {
    try {
      const { conditions, logicalOperator, actions, context } = req.body;
      if (!conditions || !actions || !context) {
        return res.status(400).json({ message: "conditions, actions, and context are required" });
      }
      const result = await policyEngine.testRule(conditions, logicalOperator ?? "AND", actions, context);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Test failed" });
    }
  });

  // Evaluate all rules against a context
  app.post("/api/policy-engine/evaluate", isAuthenticated, requireRole(...adminRoles), async (req, res) => {
    try {
      const { context, trigger } = req.body;
      if (!context) return res.status(400).json({ message: "context is required" });
      const results = await policyEngine.evaluateRules(context, trigger ?? "manual");
      res.json({ results, triggered: results.filter(r => r.matched).length });
    } catch (err) {
      res.status(500).json({ message: "Evaluation failed" });
    }
  });

  // Rule execution logs
  app.get("/api/policy-engine/logs", isAuthenticated, requireRole(...adminRoles), async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const logs = await db.select().from(policyRuleLogs)
        .orderBy(desc(policyRuleLogs.createdAt)).limit(limit);
      res.json({ logs, count: logs.length });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  // Stats
  app.get("/api/policy-engine/stats", isAuthenticated, async (_req, res) => {
    try {
      const rules = await db.select().from(policyRules);
      const logs  = await db.select().from(policyRuleLogs).orderBy(desc(policyRuleLogs.createdAt)).limit(100);
      res.json({
        total:   rules.length,
        enabled: rules.filter(r => r.enabled).length,
        totalTriggers: rules.reduce((s, r) => s + (r.triggerCount ?? 0), 0),
        recentLogs: logs.length,
        successRate: logs.length > 0
          ? parseFloat((logs.filter(l => l.result === "success").length / logs.length).toFixed(3))
          : 1,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });
}
