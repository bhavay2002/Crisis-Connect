import { storage } from "../db/storage";
import type { 
  AidOffer, 
  InsertAidOffer 
} from "@shared/schema";
import { logger } from "../utils/logger";

export class AidRepository {
  async findById(id: string): Promise<AidOffer | undefined> {
    logger.debug("Finding aid offer by ID", { id });
    return storage.getAidOffer(id);
  }

  async findAll(): Promise<AidOffer[]> {
    logger.debug("Finding all aid offers");
    return storage.getAllAidOffers();
  }

  async findByUserId(userId: string): Promise<AidOffer[]> {
    logger.debug("Finding aid offers by user", { userId });
    return storage.getAidOffersByUser(userId);
  }

  async findAvailable(): Promise<AidOffer[]> {
    logger.debug("Finding available aid offers");
    return storage.getAvailableAidOffers();
  }

  async create(offer: InsertAidOffer): Promise<AidOffer> {
    logger.debug("Creating new aid offer", { 
      resourceType: offer.resourceType, 
      quantity: offer.quantity 
    });
    return storage.createAidOffer(offer);
  }

  async updateStatus(
    id: string,
    status: "available" | "committed" | "delivered" | "cancelled"
  ): Promise<AidOffer | undefined> {
    logger.debug("Updating aid offer status", { id, status });
    return storage.updateAidOfferStatus(id, status);
  }

  async matchToRequest(offerId: string, requestId: string): Promise<AidOffer | undefined> {
    logger.debug("Matching aid offer to request", { offerId, requestId });
    return storage.matchAidOfferToRequest(offerId, requestId);
  }

  async markDelivered(offerId: string): Promise<AidOffer | undefined> {
    logger.debug("Marking aid offer as delivered", { offerId });
    return storage.markAidOfferDelivered(offerId);
  }
}

export const aidRepository = new AidRepository();
