import type { Request, Response } from "express";
import { aidService } from "../services/aid.service";
import { insertAidOfferSchema } from "@shared/schema";
import { validatePagination, createPaginatedResponse } from "@shared/pagination";
import { aidFilterSchema } from "@shared/filtering";
import { ForbiddenError, ValidationError } from "../../errors/AppError";

export class AidController {
  private broadcast?: (message: any) => void;

  setBroadcast(fn: (message: any) => void): void {
    this.broadcast = fn;
  }

  async getAllAidOffers(req: Request, res: Response): Promise<void> {
    const paginationParams = validatePagination(req.query);
    const filterValidation = aidFilterSchema.safeParse(req.query);
    
    const filter = filterValidation.success ? filterValidation.data : undefined;
    
    const { data, total } = await aidService.getAllAidOffers({
      ...paginationParams,
      filter,
    });

    const response = createPaginatedResponse(data, total, paginationParams);
    res.json(response);
  }

  async getAidOfferById(req: Request, res: Response): Promise<void> {
    const offer = await aidService.getAidOfferById(req.params.id);
    res.json(offer);
  }

  async getAidOffersByUser(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.claims.sub;
    const requestedUserId = req.params.userId;

    if (userId !== requestedUserId) {
      throw new ForbiddenError("You can only access your own aid offers");
    }

    const offers = await aidService.getAidOffersByUser(requestedUserId);
    res.json(offers);
  }

  async getAvailableAidOffers(req: Request, res: Response): Promise<void> {
    const offers = await aidService.getAvailableAidOffers();
    res.json(offers);
  }

  async createAidOffer(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.claims.sub;

    const validation = insertAidOfferSchema.safeParse({
      ...req.body,
      userId,
    });

    if (!validation.success) {
      const errorMessage = validation.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new ValidationError(errorMessage, { errors: validation.error.errors });
    }

    const offer = await aidService.createAidOffer(validation.data);

    this.broadcast?.({
      type: "new_aid_offer",
      data: offer,
    });

    res.status(201).json(offer);
  }

  async updateAidOfferStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { status } = req.body;

    if (!["available", "committed", "delivered", "cancelled"].includes(status)) {
      throw new ValidationError("Invalid status");
    }

    const offer = await aidService.updateAidOfferStatus(id, status);

    this.broadcast?.({ type: "aid_offer_updated", data: offer });

    res.json(offer);
  }

  async matchAidOfferToRequest(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { requestId } = req.body;

    if (!requestId) {
      throw new ValidationError("Request ID is required");
    }

    const offer = await aidService.matchAidOfferToRequest(id, requestId);

    this.broadcast?.({ type: "aid_offer_matched", data: offer });

    res.json(offer);
  }

  async markAidOfferDelivered(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    const offer = await aidService.markAidOfferDelivered(id);

    this.broadcast?.({ type: "aid_offer_delivered", data: offer });

    res.json(offer);
  }

  async cancelAidOffer(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    const offer = await aidService.cancelAidOffer(id);

    this.broadcast?.({ type: "aid_offer_cancelled", data: offer });

    res.json(offer);
  }
}

export const aidController = new AidController();
