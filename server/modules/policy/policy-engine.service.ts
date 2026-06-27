import { db } from "../../db/db";
import { policyRules, policyRuleLogs } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../../utils/logger";
import { eventBus } from "../events/event-bus";

type Condition = {
  field: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "in";
  value: string | number | string[];
};

type Action = {
  type: string;
  parameters?: Record<string, unknown>;
};

export interface EvaluationContext {
  severity?: string;
  type?: string;
  responseTime?: number;
  location?: string;
  confidence?: number;
  urgencyScore?: number;
  aiScore?: number;
  fusedScore?: number;
  incidentId?: string;
  reportId?: string;
  [key: string]: unknown;
}

export interface EvaluationResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  actionsExecuted: Action[];
  reasoning: string;
}

function evaluateCondition(condition: Condition, ctx: EvaluationContext): boolean {
  const raw = ctx[condition.field];
  const ctxVal = raw !== undefined ? raw : null;
  const condVal = condition.value;

  switch (condition.operator) {
    case "=":  return String(ctxVal).toLowerCase() === String(condVal).toLowerCase();
    case "!=": return String(ctxVal).toLowerCase() !== String(condVal).toLowerCase();
    case ">":  return Number(ctxVal) > Number(condVal);
    case "<":  return Number(ctxVal) < Number(condVal);
    case ">=": return Number(ctxVal) >= Number(condVal);
    case "<=": return Number(ctxVal) <= Number(condVal);
    case "contains":
      return String(ctxVal).toLowerCase().includes(String(condVal).toLowerCase());
    case "in":
      return Array.isArray(condVal) && condVal.map(String).includes(String(ctxVal));
    default:
      return false;
  }
}

async function executeAction(action: Action, ctx: EvaluationContext): Promise<void> {
  switch (action.type) {
    case "NOTIFY_AUTHORITY":
      eventBus.publish({
        type: "ALERT_BROADCAST",
        payload: {
          message: `[Policy Engine] Authority notification triggered for incident ${ctx.incidentId ?? ctx.reportId}`,
          severity: ctx.severity ?? "high",
          sentBy: "policy-engine",
        },
      });
      break;
    case "BROADCAST_ALERT":
      eventBus.publish({
        type: "ALERT_BROADCAST",
        payload: {
          message: String(action.parameters?.message ?? `Alert: Incident ${ctx.incidentId} requires attention`),
          severity: ctx.severity ?? "medium",
          sentBy: "policy-engine",
        },
      });
      break;
    case "ESCALATE":
      eventBus.publish({
        type: "CRISIS_UPDATED",
        payload: {
          reportId: ctx.reportId ?? "",
          status: "escalated",
          updatedBy: "policy-engine",
        },
      });
      break;
    case "LOG":
      logger.info("[PolicyEngine] LOG action", { ctx, parameters: action.parameters });
      break;
    default:
      logger.warn(`[PolicyEngine] Unknown action type: ${action.type}`);
  }
}

export class PolicyEngineService {
  async evaluateRules(ctx: EvaluationContext, trigger: string): Promise<EvaluationResult[]> {
    const rules = await db.select().from(policyRules)
      .where(eq(policyRules.enabled, true))
      .orderBy(desc(policyRules.priority));

    const results: EvaluationResult[] = [];

    for (const rule of rules) {
      try {
        const conditions = rule.conditions as Condition[];
        const actions    = rule.actions    as Action[];
        const op         = rule.logicalOperator ?? "AND";

        const condResults = conditions.map(c => evaluateCondition(c, ctx));
        const matched = op === "OR"
          ? condResults.some(Boolean)
          : condResults.every(Boolean);

        if (matched) {
          for (const action of actions) {
            await executeAction(action, ctx);
          }

          await db.update(policyRules).set({
            triggerCount: (rule.triggerCount ?? 0) + 1,
            lastTriggeredAt: new Date(),
          }).where(eq(policyRules.id, rule.id));

          await db.insert(policyRuleLogs).values({
            ruleId: rule.id,
            triggeredBy: trigger,
            eventData: ctx as any,
            actionsExecuted: actions as any,
            result: "success",
          });

          logger.info(`[PolicyEngine] Rule "${rule.name}" triggered`, { trigger, incidentId: ctx.incidentId });
        }

        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          matched,
          actionsExecuted: matched ? (actions as Action[]) : [],
          reasoning: matched
            ? `Matched (${op}): ${conditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(` ${op} `)}`
            : `No match for conditions: ${conditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(` ${op} `)}`,
        });
      } catch (err) {
        logger.error(`[PolicyEngine] Rule ${rule.id} evaluation error`, err as Error);
        await db.insert(policyRuleLogs).values({
          ruleId: rule.id,
          triggeredBy: trigger,
          eventData: ctx as any,
          actionsExecuted: [] as any,
          result: "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  async testRule(conditions: Condition[], logicalOperator: string, actions: Action[], ctx: EvaluationContext) {
    const op = logicalOperator ?? "AND";
    const condResults = conditions.map(c => ({ condition: c, matched: evaluateCondition(c, ctx) }));
    const overallMatch = op === "OR"
      ? condResults.some(r => r.matched)
      : condResults.every(r => r.matched);

    return {
      matched: overallMatch,
      conditionResults: condResults,
      actionsWouldExecute: overallMatch ? actions : [],
      testContext: ctx,
    };
  }

  async seedDefaultRules(createdBy?: string) {
    const existing = await db.select().from(policyRules).limit(1);
    if (existing.length > 0) return;

    const defaults = [
      {
        name: "Critical + Slow Response → Notify Authority",
        description: "If an incident is critical AND response time exceeds 60s, immediately notify authority",
        conditions: [
          { field: "severity", operator: "=" as const, value: "critical" },
          { field: "responseTime", operator: ">" as const, value: 60 },
        ],
        logicalOperator: "AND",
        actions: [{ type: "NOTIFY_AUTHORITY" }],
        enabled: true,
        priority: 100,
        createdBy,
      },
      {
        name: "High AI Score → Broadcast Alert",
        description: "If AI confidence score exceeds 0.85, broadcast a public alert",
        conditions: [
          { field: "aiScore", operator: ">=" as const, value: 0.85 },
        ],
        logicalOperator: "AND",
        actions: [{ type: "BROADCAST_ALERT", parameters: { message: "High-confidence incident detected by AI" } }],
        enabled: true,
        priority: 80,
        createdBy,
      },
      {
        name: "Flood OR Earthquake → Escalate",
        description: "Any flood or earthquake report should be immediately escalated",
        conditions: [
          { field: "type", operator: "in" as const, value: ["flood", "earthquake"] },
        ],
        logicalOperator: "AND",
        actions: [{ type: "ESCALATE" }, { type: "NOTIFY_AUTHORITY" }],
        enabled: true,
        priority: 90,
        createdBy,
      },
      {
        name: "Low Confidence < 30% → Log Only",
        description: "Very low AI confidence reports are logged but no automated actions taken",
        conditions: [
          { field: "confidence", operator: "<" as const, value: 0.3 },
        ],
        logicalOperator: "AND",
        actions: [{ type: "LOG", parameters: { note: "Low confidence report — monitoring only" } }],
        enabled: true,
        priority: 10,
        createdBy,
      },
    ];

    await db.insert(policyRules).values(defaults as any);
    logger.info("[PolicyEngine] Seeded 4 default rules");
  }
}

export const policyEngine = new PolicyEngineService();
