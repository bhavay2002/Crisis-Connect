import { storage } from "./storage";
import type { InsertNotification } from "@shared/schema";

export class NotificationService {
  static async createAndBroadcastNotification(
    notification: InsertNotification,
    broadcastFn: (message: any) => void
  ) {
    const createdNotification = await storage.createNotification(notification);
    
    broadcastFn({
      type: "new_notification",
      data: createdNotification,
    });
    
    return createdNotification;
  }

  static async notifyDisasterNearby(
    userId: string,
    disasterTitle: string,
    disasterId: string,
    location: string,
    severity: string,
    broadcastFn: (message: any) => void
  ) {
    const preferences = await storage.getNotificationPreferences(userId);
    if (preferences && !preferences.disasterNearby) {
      return;
    }

    const priorityMap: Record<string, "low" | "medium" | "high" | "critical"> = {
      low: "low",
      medium: "medium",
      high: "high",
      critical: "critical",
    };

    return await this.createAndBroadcastNotification(
      {
        userId,
        type: "disaster_nearby",
        priority: priorityMap[severity] || "medium",
        title: "Disaster Alert Nearby",
        message: `${disasterTitle} reported near ${location}`,
        actionUrl: `/reports/${disasterId}`,
        relatedEntityId: disasterId,
        relatedEntityType: "disaster_report",
      },
      broadcastFn
    );
  }

  static async notifyDisasterVerified(
    userId: string,
    disasterTitle: string,
    disasterId: string,
    broadcastFn: (message: any) => void
  ) {
    const preferences = await storage.getNotificationPreferences(userId);
    if (preferences && !preferences.disasterVerified) {
      return;
    }

    return await this.createAndBroadcastNotification(
      {
        userId,
        type: "disaster_verified",
        priority: "medium",
        title: "Report Verified",
        message: `Your report "${disasterTitle}" has been verified`,
        actionUrl: `/reports/${disasterId}`,
        relatedEntityId: disasterId,
        relatedEntityType: "disaster_report",
      },
      broadcastFn
    );
  }

  static async notifyDisasterResolved(
    userId: string,
    disasterTitle: string,
    disasterId: string,
    broadcastFn: (message: any) => void
  ) {
    const preferences = await storage.getNotificationPreferences(userId);
    if (preferences && !preferences.disasterResolved) {
      return;
    }

    return await this.createAndBroadcastNotification(
      {
        userId,
        type: "disaster_resolved",
        priority: "low",
        title: "Disaster Resolved",
        message: `The disaster "${disasterTitle}" has been resolved`,
        actionUrl: `/reports/${disasterId}`,
        relatedEntityId: disasterId,
        relatedEntityType: "disaster_report",
      },
      broadcastFn
    );
  }

  static async notifySOSAlert(
    userId: string,
    location: string,
    emergencyType: string,
    sosId: string,
    severity: string,
    broadcastFn: (message: any) => void
  ) {
    const preferences = await storage.getNotificationPreferences(userId);
    if (preferences && !preferences.sosAlert) {
      return;
    }

    const priorityMap: Record<string, "low" | "medium" | "high" | "critical"> = {
      low: "medium",
      medium: "high",
      high: "critical",
      critical: "critical",
    };

    return await this.createAndBroadcastNotification(
      {
        userId,
        type: "sos_alert",
        priority: priorityMap[severity] || "critical",
        title: "SOS Alert",
        message: `Emergency ${emergencyType} reported at ${location}. Immediate response needed!`,
        actionUrl: `/sos/${sosId}`,
        relatedEntityId: sosId,
        relatedEntityType: "sos_alert",
      },
      broadcastFn
    );
  }

  static async notifyResourceRequest(
    userId: string,
    resourceType: string,
    location: string,
    requestId: string,
    urgency: string,
    broadcastFn: (message: any) => void
  ) {
    const preferences = await storage.getNotificationPreferences(userId);
    if (preferences && !preferences.resourceRequest) {
      return;
    }

    const priorityMap: Record<string, "low" | "medium" | "high" | "critical"> = {
      low: "low",
      medium: "medium",
      high: "high",
      critical: "critical",
    };

    return await this.createAndBroadcastNotification(
      {
        userId,
        type: "resource_request",
        priority: priorityMap[urgency] || "medium",
        title: "Resource Request",
        message: `${resourceType} needed at ${location}`,
        actionUrl: `/resources/requests/${requestId}`,
        relatedEntityId: requestId,
        relatedEntityType: "resource_request",
      },
      broadcastFn
    );
  }

  static async notifyResourceFulfilled(
    userId: string,
    resourceType: string,
    requestId: string,
    broadcastFn: (message: any) => void
  ) {
    const preferences = await storage.getNotificationPreferences(userId);
    if (preferences && !preferences.resourceFulfilled) {
      return;
    }

    return await this.createAndBroadcastNotification(
      {
        userId,
        type: "resource_fulfilled",
        priority: "medium",
        title: "Resource Fulfilled",
        message: `Your ${resourceType} request has been fulfilled`,
        actionUrl: `/resources/requests/${requestId}`,
        relatedEntityId: requestId,
        relatedEntityType: "resource_request",
      },
      broadcastFn
    );
  }

  static async notifyAidMatched(
    userId: string,
    resourceType: string,
    offerId: string,
    broadcastFn: (message: any) => void
  ) {
    const preferences = await storage.getNotificationPreferences(userId);
    if (preferences && !preferences.aidMatched) {
      return;
    }

    return await this.createAndBroadcastNotification(
      {
        userId,
        type: "aid_matched",
        priority: "medium",
        title: "Aid Matched",
        message: `Your ${resourceType} aid offer has been matched with a request`,
        actionUrl: `/resources/aid/${offerId}`,
        relatedEntityId: offerId,
        relatedEntityType: "aid_offer",
      },
      broadcastFn
    );
  }

  static async notifyReportAssigned(
    userId: string,
    disasterTitle: string,
    disasterId: string,
    broadcastFn: (message: any) => void
  ) {
    const preferences = await storage.getNotificationPreferences(userId);
    if (preferences && !preferences.reportAssigned) {
      return;
    }

    return await this.createAndBroadcastNotification(
      {
        userId,
        type: "report_assigned",
        priority: "high",
        title: "Report Assigned",
        message: `You have been assigned to handle "${disasterTitle}"`,
        actionUrl: `/reports/${disasterId}`,
        relatedEntityId: disasterId,
        relatedEntityType: "disaster_report",
      },
      broadcastFn
    );
  }

  static async notifyReportConfirmed(
    userId: string,
    disasterTitle: string,
    disasterId: string,
    broadcastFn: (message: any) => void
  ) {
    const preferences = await storage.getNotificationPreferences(userId);
    if (preferences && !preferences.reportConfirmed) {
      return;
    }

    return await this.createAndBroadcastNotification(
      {
        userId,
        type: "report_confirmed",
        priority: "medium",
        title: "Report Confirmed",
        message: `Your report "${disasterTitle}" has been confirmed by authorities`,
        actionUrl: `/reports/${disasterId}`,
        relatedEntityId: disasterId,
        relatedEntityType: "disaster_report",
      },
      broadcastFn
    );
  }

  static async notifyLowInventory(
    userId: string,
    itemName: string,
    quantity: number,
    itemId: string,
    broadcastFn: (message: any) => void
  ) {
    const preferences = await storage.getNotificationPreferences(userId);
    if (preferences && !preferences.lowInventory) {
      return;
    }

    return await this.createAndBroadcastNotification(
      {
        userId,
        type: "low_inventory",
        priority: "high",
        title: "Low Inventory Alert",
        message: `${itemName} is running low (${quantity} remaining)`,
        actionUrl: `/inventory/${itemId}`,
        relatedEntityId: itemId,
        relatedEntityType: "inventory_item",
      },
      broadcastFn
    );
  }

  static async notifySystem(
    userId: string,
    title: string,
    message: string,
    priority: "low" | "medium" | "high" | "critical",
    actionUrl?: string,
    broadcastFn?: (message: any) => void
  ) {
    const preferences = await storage.getNotificationPreferences(userId);
    if (preferences && !preferences.systemAlert) {
      return;
    }

    const notification: InsertNotification = {
      userId,
      type: "system_alert",
      priority,
      title,
      message,
      actionUrl,
    };

    if (broadcastFn) {
      return await this.createAndBroadcastNotification(notification, broadcastFn);
    } else {
      return await storage.createNotification(notification);
    }
  }

  static async notifyNearbyVolunteers(
    disasterId: string,
    disasterTitle: string,
    location: string,
    latitude: string | null,
    longitude: string | null,
    severity: string,
    broadcastFn: (message: any) => void
  ) {
    if (!latitude || !longitude) {
      return;
    }

    const volunteers = await storage.getAssignableUsers();
    
    for (const volunteer of volunteers) {
      const preferences = await storage.getNotificationPreferences(volunteer.id);
      const radius = preferences?.notificationRadius || 50;
      
      await this.notifyDisasterNearby(
        volunteer.id,
        disasterTitle,
        disasterId,
        location,
        severity,
        broadcastFn
      );
    }
  }

  static async notifyNearbyRespondersForSOS(
    sosId: string,
    location: string,
    latitude: string | null,
    longitude: string | null,
    emergencyType: string,
    severity: string,
    broadcastFn: (message: any) => void
  ) {
    if (!latitude || !longitude) {
      return;
    }

    const responders = await storage.findNearbyResponders(latitude, longitude, 50);
    
    for (const responder of responders) {
      await this.notifySOSAlert(
        responder.id,
        location,
        emergencyType,
        sosId,
        severity,
        broadcastFn
      );
    }
  }
}
