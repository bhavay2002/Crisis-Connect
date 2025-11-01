import { storage } from "../db/storage";
import type { 
  ResourceRequest, 
  InsertResourceRequest 
} from "@shared/schema";
import { logger } from "../utils/logger";

export interface PaginatedResourcesResult {
  requests: ResourceRequest[];
  total: number;
}

export class ResourceRepository {
  async findById(id: string): Promise<ResourceRequest | undefined> {
    logger.debug("Finding resource request by ID", { id });
    return storage.getResourceRequest(id);
  }

  async findAll(): Promise<ResourceRequest[]> {
    logger.debug("Finding all resource requests");
    return storage.getAllResourceRequests();
  }

  async findPaginated(
    limit: number,
    offset: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Promise<PaginatedResourcesResult> {
    logger.debug("Finding paginated resource requests", { limit, offset, sortBy, sortOrder });
    return storage.getPaginatedResourceRequests(limit, offset, sortBy, sortOrder);
  }

  async findByUserId(userId: string): Promise<ResourceRequest[]> {
    logger.debug("Finding resource requests by user", { userId });
    return storage.getResourceRequestsByUser(userId);
  }

  async create(request: InsertResourceRequest): Promise<ResourceRequest> {
    logger.debug("Creating new resource request", { 
      resourceType: request.resourceType, 
      urgency: request.urgency 
    });
    return storage.createResourceRequest(request);
  }

  async updateStatus(
    id: string,
    status: "pending" | "in_progress" | "fulfilled" | "cancelled"
  ): Promise<ResourceRequest | undefined> {
    logger.debug("Updating resource request status", { id, status });
    return storage.updateResourceRequestStatus(id, status);
  }

  async fulfill(id: string, userId: string): Promise<ResourceRequest | undefined> {
    logger.debug("Fulfilling resource request", { id, userId });
    return storage.fulfillResourceRequest(id, userId);
  }
}

export const resourceRepository = new ResourceRepository();
