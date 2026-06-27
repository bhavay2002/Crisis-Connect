import { db } from "../../db/db";
import { decisions, incidentMetrics } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../utils/logger";

interface DecisionInput {
  reportId: string;
  reportTitle?: string;
  aiScore: number;
  severity: "low" | "medium" | "high" | "critical";
}

interface SignalComponents {
  aiUrgency: number;
  locationRisk: number;
  repetition: number;
  trust: number;
}

const SEVERITY_RISK: Record<string, number> = {
  critical: 90,
  high: 70,
  medium: 40,
  low: 20,
};

export class DecisionEngineService {
  async generateDecision(input: DecisionInput): Promise<void> {
    try {
      const { reportId, reportTitle, aiScore, severity } = input;

      const components: SignalComponents = {
        aiUrgency: aiScore,
        locationRisk: SEVERITY_RISK[severity] ?? 40,
        repetition: 50,
        trust: 70,
      };

      const fusedScore =
        (components.aiUrgency * 0.5 +
          components.locationRisk * 0.2 +
          components.repetition * 0.2 +
          components.trust * 0.1) /
        100;

      await db
        .insert(incidentMetrics)
        .values({
          incidentId: reportId,
          detectedAt: new Date(),
          slaTargetSeconds: 60,
        })
        .onConflictDoNothing();

      let type: "DISPATCH" | "ESCALATE" | "BROADCAST" | "PREDEPLOY";
      let autoExecutable = false;
      let reason: string;
      let confidence: number;

      if (fusedScore >= 0.8) {
        type = "DISPATCH";
        autoExecutable = true;
        confidence = Math.min(Math.round(fusedScore * 115), 100);
        reason = `Fused score ${(fusedScore * 100).toFixed(0)}% exceeds critical threshold — AI urgency high, risk zone confirmed. Auto-dispatching response team.`;
      } else if (fusedScore >= 0.6 && components.repetition >= 65) {
        type = "BROADCAST";
        autoExecutable = false;
        confidence = Math.round(fusedScore * 100);
        reason = `Elevated repetition density in affected area (${components.repetition}%) — area-wide alert recommended. Awaiting operator approval.`;
      } else if (fusedScore >= 0.6) {
        type = "ESCALATE";
        autoExecutable = false;
        confidence = Math.round(fusedScore * 100);
        reason = `Fused score ${(fusedScore * 100).toFixed(0)}% requires escalation — AI signals elevated but not conclusive for auto-dispatch.`;
      } else if (fusedScore >= 0.35) {
        type = "PREDEPLOY";
        autoExecutable = false;
        confidence = Math.round(fusedScore * 100);
        reason = `Moderate risk detected (${(fusedScore * 100).toFixed(0)}%) — pre-positioning resources in area advised.`;
      } else {
        return;
      }

      const recommendedActions = this.buildActions(type, reportId, severity);

      const [decision] = await db
        .insert(decisions)
        .values({
          incidentId: reportId,
          incidentTitle: reportTitle,
          type,
          confidence,
          severity,
          reason,
          contributingSignals: components,
          recommendedActions,
          autoExecutable,
          status: autoExecutable ? "APPROVED" : "PENDING",
        })
        .returning();

      await db
        .update(incidentMetrics)
        .set({ decisionAt: new Date() })
        .where(eq(incidentMetrics.incidentId, reportId));

      if (autoExecutable && decision) {
        await this.executeDecision(decision.id, reportId);
      }

      logger.info("[DecisionEngine] Generated decision", {
        reportId,
        type,
        confidence,
        autoExecutable,
      });
    } catch (err) {
      logger.error("[DecisionEngine] Failed to generate decision", err as Error, {
        reportId: input.reportId,
      });
    }
  }

  async approveDecision(decisionId: string, userId: string): Promise<void> {
    await db
      .update(decisions)
      .set({ status: "APPROVED", executedBy: userId })
      .where(eq(decisions.id, decisionId));
  }

  async executeDecision(decisionId: string, incidentId: string): Promise<void> {
    await db
      .update(decisions)
      .set({ status: "EXECUTED", executedAt: new Date() })
      .where(eq(decisions.id, decisionId));

    await db
      .update(incidentMetrics)
      .set({ dispatchedAt: new Date() })
      .where(eq(incidentMetrics.incidentId, incidentId));
  }

  async rejectDecision(
    decisionId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    await db
      .update(decisions)
      .set({ status: "REJECTED", rejectedBy: userId, rejectedReason: reason })
      .where(eq(decisions.id, decisionId));
  }

  private buildActions(
    type: string,
    reportId: string,
    severity: string
  ): Array<{ type: string; priority: number; parameters: Record<string, unknown> }> {
    if (type === "DISPATCH") {
      return [
        { type: "DISPATCH_TEAM", priority: 1, parameters: { reportId, urgency: severity } },
        { type: "NOTIFY_AUTHORITY", priority: 2, parameters: { reportId } },
      ];
    }
    if (type === "BROADCAST") {
      return [{ type: "SEND_ALERT", priority: 1, parameters: { reportId, scope: "area" } }];
    }
    if (type === "ESCALATE") {
      return [{ type: "NOTIFY_AUTHORITY", priority: 1, parameters: { reportId } }];
    }
    if (type === "PREDEPLOY") {
      return [
        { type: "DISPATCH_TEAM", priority: 2, parameters: { reportId, mode: "staging" } },
      ];
    }
    return [];
  }
}

export const decisionEngine = new DecisionEngineService();
