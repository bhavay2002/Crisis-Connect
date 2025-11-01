import { resourceRepository } from "../repositories/resource.repository";
import type { ResourceRequest, InsertResourceRequest } from "@shared/schema";
import type { PaginationParams } from "@shared/pagination";
import type { ResourceFilter } from "@shared/filtering";
import { logger } from "../utils/logger";
import { NotFoundError, ConflictError } from "../errors/AppError";

export interface ResourceQueryResult {
  data: ResourceRequest[];
  total: number;
}

export interface ResourceQueryParams extends PaginationParams {
  filter?: ResourceFilter;
}

export class ResourceService {
  async getAllResourceRequests(params?: ResourceQueryParams): Promise<ResourceQueryResult> {
    logger.debug("Fetching all resource requests", { params });
    
    let requests = await resourceRepository.findAll();
    
    // Apply filters
    if (params?.filter) {
      requests = this.applyFilters(requests, params.filter);
    }
    
    const total = requests.length;
    
    // Apply pagination
    if (params) {
      const { page, limit, sortBy, sortOrder } = params;
      const offset = (page - 1) * limit;
      
      if (sortBy) {
        requests = this.sortRequests(requests, sortBy, sortOrder);
      }
      
      requests = requests.slice(offset, offset + limit);
    }
    
    return { data: requests, total };
  }

  private applyFilters(requests: ResourceRequest[], filter: ResourceFilter): ResourceRequest[] {
    return requests.filter(request => {
      if (filter.status && request.status !== filter.status) return false;
      if (filter.resourceType && request.resourceType !== filter.resourceType) return false;
      if (filter.urgency && request.urgency !== filter.urgency) return false;
      if (filter.userId && request.userId !== filter.userId) return false;
      if (filter.location && !request.location.toLowerCase().includes(filter.location.toLowerCase())) return false;
      
      const createdAt = new Date(request.createdAt);
      if (filter.startDate && createdAt < filter.startDate) return false;
      if (filter.endDate && createdAt > filter.endDate) return false;
      
      return true;
    });
  }

  private sortRequests(requests: ResourceRequest[], sortBy: string, sortOrder: "asc" | "desc"): ResourceRequest[] {
    return requests.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      if (aVal === bVal) return 0;
      const comparison = aVal > bVal ? 1 : -1;
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }

  async getResourceRequestById(id: string): Promise<ResourceRequest> {
    const request = await resourceRepository.findById(id);
    if (!request) {
      throw new NotFoundError("Resource request");
    }
    return request;
  }

  async getResourceRequestsByUser(userId: string): Promise<ResourceRequest[]> {
    logger.debug("Fetching resource requests for user", { userId });
    return resourceRepository.findByUserId(userId);
  }

  async getPendingResourceRequests(): Promise<ResourceRequest[]> {
    logger.debug("Fetching pending resource requests");
    const allRequests = await resourceRepository.findAll();
    return allRequests.filter(r => r.status === "pending");
  }

  async createResourceRequest(data: InsertResourceRequest): Promise<ResourceRequest> {
    logger.info("Creating new resource request", {
      userId: data.userId,
      resourceType: data.resourceType,
      urgency: data.urgency,
    });

    const request = await resourceRepository.create(data);

    logger.info("Resource request created successfully", { requestId: request.id });
    return request;
  }

  async updateResourceRequestStatus(
    id: string,
    status: "pending" | "in_progress" | "fulfilled" | "cancelled"
  ): Promise<ResourceRequest> {
    logger.info("Updating resource request status", { requestId: id, status });

    const request = await resourceRepository.updateStatus(id, status);
    if (!request) {
      throw new NotFoundError("Resource request");
    }

    return request;
  }

  async fulfillResourceRequest(id: string, userId: string): Promise<ResourceRequest> {
    logger.info("Fulfilling resource request", { requestId: id, userId });

    const request = await resourceRepository.fulfill(id, userId);
    if (!request) {
      throw new NotFoundError("Resource request");
    }

    return request;
  }

  async cancelResourceRequest(id: string): Promise<ResourceRequest> {
    logger.info("Cancelling resource request", { requestId: id });

    const request = await resourceRepository.updateStatus(id, "cancelled");
    if (!request) {
      throw new NotFoundError("Resource request");
    }

    return request;
  }
}

export const resourceService = new ResourceService();
