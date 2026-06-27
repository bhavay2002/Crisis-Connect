import { EventEmitter } from "events";
import { logger } from "../../utils/logger";

export type CrisisEvent =
  | { type: "CRISIS_CREATED";  payload: { reportId: string; userId?: string; type: string; severity: string; location: string } }
  | { type: "CRISIS_UPDATED";  payload: { reportId: string; status: string; updatedBy?: string } }
  | { type: "SOS_ACTIVATED";   payload: { sosId: string; userId: string; location: string } }
  | { type: "SOS_RESOLVED";    payload: { sosId: string; respondedBy?: string } }
  | { type: "INCIDENT_MERGED"; payload: { incidentId: string; reportIds: string[] } }
  | { type: "ALERT_BROADCAST"; payload: { message: string; severity: string; sentBy?: string } }
  | { type: "USER_REGISTERED"; payload: { userId: string; role: string } }
  | { type: "ORG_CREATED";     payload: { orgId: string; name: string; type: string; createdBy: string } }
  | { type: "IOT_EVENT";       payload: { sensorType: string; reportId: string; autoDispatch: boolean } };

export type EventType = CrisisEvent["type"];

class CrisisEventBus extends EventEmitter {
  private static instance: CrisisEventBus;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  static getInstance(): CrisisEventBus {
    if (!CrisisEventBus.instance) {
      CrisisEventBus.instance = new CrisisEventBus();
    }
    return CrisisEventBus.instance;
  }

  publish(event: CrisisEvent): void {
    logger.info(`[EventBus] Publishing ${event.type}`, { payload: event.payload });
    this.emit(event.type, event.payload);
    this.emit("*", event);
  }

  subscribe<T extends EventType>(
    eventType: T,
    handler: (payload: Extract<CrisisEvent, { type: T }>["payload"]) => void
  ): void {
    this.on(eventType, handler);
    logger.info(`[EventBus] Subscriber registered for ${eventType}`);
  }

  subscribeAll(handler: (event: CrisisEvent) => void): void {
    this.on("*", handler);
  }

  unsubscribe(eventType: string, handler: (...args: any[]) => void): void {
    this.off(eventType, handler);
  }

  getListenerCount(eventType: string): number {
    return this.listenerCount(eventType);
  }

  getStats(): Record<string, number> {
    const events: EventType[] = [
      "CRISIS_CREATED", "CRISIS_UPDATED", "SOS_ACTIVATED", "SOS_RESOLVED",
      "INCIDENT_MERGED", "ALERT_BROADCAST", "USER_REGISTERED", "ORG_CREATED", "IOT_EVENT",
    ];
    return Object.fromEntries(events.map(e => [e, this.listenerCount(e)]));
  }
}

export const eventBus = CrisisEventBus.getInstance();
