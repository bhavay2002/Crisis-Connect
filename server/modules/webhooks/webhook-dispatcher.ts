import crypto from "crypto";
import { db } from "../../db/db";
import { webhookSubscriptions, webhookDeliveries } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { withRetry } from "../resilience/retry";
import { logger } from "../../utils/logger";

export interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
  id: string;
}

function signPayload(payload: string, secret: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function deliverToSubscription(sub: typeof webhookSubscriptions.$inferSelect, payload: WebhookPayload): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, sub.secret);

  await withRetry(async () => {
    const res = await fetch(sub.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CrisisConnect-Signature": signature,
        "X-CrisisConnect-Event": payload.event,
        "X-CrisisConnect-Delivery": payload.id,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Webhook delivery failed: ${res.status}`);
  }, {
    attempts: 4,
    baseDelayMs: 1000,
    onRetry: (attempt, err) => {
      logger.warn(`[Webhooks] Retry ${attempt} for sub ${sub.id}: ${err.message}`);
    },
  });
}

export async function dispatchWebhookEvent(eventType: string, data: Record<string, unknown>): Promise<void> {
  try {
    const subs = await db.select().from(webhookSubscriptions)
      .where(and(eq(webhookSubscriptions.isActive, true)));

    const matching = subs.filter(s => s.events.includes(eventType) || s.events.includes("*"));
    if (matching.length === 0) return;

    const deliveryId = crypto.randomUUID();
    const payload: WebhookPayload = {
      event: eventType,
      data,
      timestamp: new Date().toISOString(),
      id: deliveryId,
    };

    for (const sub of matching) {
      (async () => {
        let success = false;
        let statusCode: number | undefined;
        let error: string | undefined;
        let attempts = 1;

        try {
          const body = JSON.stringify(payload);
          const signature = signPayload(body, sub.secret);
          await withRetry(async () => {
            const res = await fetch(sub.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-CrisisConnect-Signature": signature,
                "X-CrisisConnect-Event": payload.event,
                "X-CrisisConnect-Delivery": payload.id,
              },
              body,
              signal: AbortSignal.timeout(10000),
            });
            statusCode = res.status;
            if (!res.ok) { attempts++; throw new Error(`HTTP ${res.status}`); }
          }, { attempts: 4, baseDelayMs: 1000 });
          success = true;
          logger.info(`[Webhooks] Delivered ${eventType} to ${sub.url} (sub: ${sub.id})`);
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          logger.error(`[Webhooks] Delivery failed to ${sub.url}`, err instanceof Error ? err : undefined);
          await db.update(webhookSubscriptions)
            .set({ failureCount: (sub.failureCount || 0) + 1, isActive: (sub.failureCount || 0) < 9 })
            .where(eq(webhookSubscriptions.id, sub.id));
        }

        await db.insert(webhookDeliveries).values({
          subscriptionId: sub.id,
          event: eventType,
          payload,
          statusCode,
          attempts,
          success,
          error,
          deliveredAt: success ? new Date() : undefined,
        });

        if (success) {
          await db.update(webhookSubscriptions)
            .set({ lastDeliveredAt: new Date(), failureCount: 0 })
            .where(eq(webhookSubscriptions.id, sub.id));
        }
      })();
    }
  } catch (err) {
    logger.error("[Webhooks] dispatchWebhookEvent error", err instanceof Error ? err : undefined);
  }
}
