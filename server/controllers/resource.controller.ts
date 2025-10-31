import type { Request, Response } from "express";
import { resourceService } from "../services/resource.service";
import { insertResourceRequestSchema } from "@shared/schema";
import { validatePagination, createPaginatedResponse } from "@shared/pagination";
import { resourceFilterSchema } from "@shared/filtering";
import { logger } from "../utils/logger";
import { ForbiddenError, ValidationError } from "../errors/AppError";

export class ResourceController {
  private broadcast?: (message: any) => void;

  setBroadcast(fn: (message: any) => void): void {
    this.broadcast = fn;
  }

  async getAllResourceRequests(req: Request, res: Response): Promise<void> {
    const paginationParams = validatePagination(req.query);
    const filterValidation = resourceFilterSchema.safeParse(req.query);
    
    const filter = filterValidation.success ? filterValidation.data : undefined;
    
    const { data, total } = await resourceService.getAllResourceRequests({
      ...paginationParams,
      filter,
    });

    const response = createPaginatedResponse(data, total, paginationParams);
    res.json(response);
  }

  async getResourceRequestById(req: Request, res: Response): Promise<void> {
    const request = await resourceService.getResourceRequestById(req.params.id);
    res.json(request);
  }

  async getResourceRequestsByUser(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.claims.sub;
    const requestedUserId = req.params.userId;

    if (userId !== requestedUserId) {
      throw new ForbiddenError("You can only access your own resource requests");
    }

    const requests = await resourceService.getResourceRequestsByUser(requestedUserId);
    res.json(requests);
  }

  async getPendingResourceRequests(req: Request, res: Response): Promise<void> {
    const requests = await resourceService.getPendingResourceRequests();
    res.json(requests);
  }

  async createResourceRequest(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.claims.sub;

    const validation = insertResourceRequestSchema.safeParse({
      ...req.body,
      userId,
    });

    if (!validation.success) {
      const errorMessage = validation.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new ValidationError(errorMessage, { errors: validation.error.errors });
    }

    const request = await resourceService.createResourceRequest(validation.data);

    this.broadcast?.({
      type: "new_resource_request",
      data: request,
    });

    res.status(201).json(request);
  }

  async updateResourceRequestStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "in_progress", "fulfilled", "cancelled"].includes(status)) {
      throw new ValidationError("Invalid status");
    }

    const request = await resourceService.updateResourceRequestStatus(id, status);

    this.broadcast?.({ type: "resource_request_updated", data: request });

    res.json(request);
  }

  async fulfillResourceRequest(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.claims.sub;
    const { id } = req.params;

    const request = await resourceService.fulfillResourceRequest(id, userId);

    this.broadcast?.({ type: "resource_request_fulfilled", data: request });

    res.json(request);
  }

  async cancelResourceRequest(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    const request = await resourceService.cancelResourceRequest(id);

    this.broadcast?.({ type: "resource_request_cancelled", data: request });

    res.json(request);
  }
}

export const resourceController = new ResourceController();
