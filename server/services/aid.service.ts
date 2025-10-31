import { storage } from "../db/storage";
import type { AidOffer, InsertAidOffer } from "@shared/schema";
import type { PaginationParams } from "@shared/pagination";
import type { AidFilter } from "@shared/filtering";
import { logger } from "../utils/logger";
import { NotFoundError } from "../errors/AppError";

export interface AidQueryResult {
  data: AidOffer[];
  total: number;
}

export interface AidQueryParams extends PaginationParams {
  filter?: AidFilter;
}

export class AidService {
  async getAllAidOffers(params?: AidQueryParams): Promise<AidQueryResult> {
    logger.debug("Fetching all aid offers", { params });
    
    let offers = await storage.getAllAidOffers();
    
    // Apply filters
    if (params?.filter) {
      offers = this.applyFilters(offers, params.filter);
    }
    
    const total = offers.length;
    
    // Apply pagination
    if (params) {
      const { page, limit, sortBy, sortOrder } = params;
      const offset = (page - 1) * limit;
      
      if (sortBy) {
        offers = this.sortOffers(offers, sortBy, sortOrder);
      }
      
      offers = offers.slice(offset, offset + limit);
    }
    
    return { data: offers, total };
  }

  private applyFilters(offers: AidOffer[], filter: AidFilter): AidOffer[] {
    return offers.filter(offer => {
      if (filter.status && offer.status !== filter.status) return false;
      if (filter.aidType && offer.resourceType !== filter.aidType) return false;
      if (filter.userId && offer.userId !== filter.userId) return false;
      if (filter.location && !offer.location.toLowerCase().includes(filter.location.toLowerCase())) return false;
      if (filter.matchedToRequestId && offer.matchedRequestId !== filter.matchedToRequestId) return false;
      
      const createdAt = new Date(offer.createdAt);
      if (filter.startDate && createdAt < filter.startDate) return false;
      if (filter.endDate && createdAt > filter.endDate) return false;
      
      return true;
    });
  }

  private sortOffers(offers: AidOffer[], sortBy: string, sortOrder: "asc" | "desc"): AidOffer[] {
    return offers.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      if (aVal === bVal) return 0;
      const comparison = aVal > bVal ? 1 : -1;
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }

  async getAidOfferById(id: string): Promise<AidOffer> {
    const offer = await storage.getAidOffer(id);
    if (!offer) {
      throw new NotFoundError("Aid offer");
    }
    return offer;
  }

  async getAidOffersByUser(userId: string): Promise<AidOffer[]> {
    logger.debug("Fetching aid offers for user", { userId });
    return storage.getAidOffersByUser(userId);
  }

  async getAvailableAidOffers(): Promise<AidOffer[]> {
    logger.debug("Fetching available aid offers");
    return storage.getAvailableAidOffers();
  }

  async createAidOffer(data: InsertAidOffer): Promise<AidOffer> {
    logger.info("Creating new aid offer", {
      userId: data.userId,
      quantity: data.quantity,
    });

    const offer = await storage.createAidOffer(data);

    logger.info("Aid offer created successfully", { offerId: offer.id });
    return offer;
  }

  async updateAidOfferStatus(
    id: string,
    status: "available" | "committed" | "delivered" | "cancelled"
  ): Promise<AidOffer> {
    logger.info("Updating aid offer status", { offerId: id, status });

    const offer = await storage.updateAidOfferStatus(id, status);
    if (!offer) {
      throw new NotFoundError("Aid offer");
    }

    return offer;
  }

  async matchAidOfferToRequest(offerId: string, requestId: string): Promise<AidOffer> {
    logger.info("Matching aid offer to request", { offerId, requestId });

    const offer = await storage.matchAidOfferToRequest(offerId, requestId);
    if (!offer) {
      throw new NotFoundError("Aid offer");
    }

    return offer;
  }

  async markAidOfferDelivered(id: string): Promise<AidOffer> {
    logger.info("Marking aid offer as delivered", { offerId: id });

    const offer = await storage.markAidOfferDelivered(id);
    if (!offer) {
      throw new NotFoundError("Aid offer");
    }

    return offer;
  }

  async cancelAidOffer(id: string): Promise<AidOffer> {
    logger.info("Cancelling aid offer", { offerId: id });

    const offer = await storage.updateAidOfferStatus(id, "cancelled");
    if (!offer) {
      throw new NotFoundError("Aid offer");
    }

    return offer;
  }
}

export const aidService = new AidService();
