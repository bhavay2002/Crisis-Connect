import OpenAI from "openai";
import type { ResourceRequest, AidOffer } from "../shared/schema";
import { logger } from "../../utils/logger";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return null;
  }
  
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  
  return openai;
}

export interface Match {
  requestId: string;
  offerId: string;
  score: number; // 0-100, higher means better match
  distance?: number; // in kilometers if GPS available
  reasoning: string;
}

export class AIMatchingService {
  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Find best matches for a resource request from available aid offers
   */
  async findMatchesForRequest(
    request: ResourceRequest,
    availableOffers: AidOffer[]
  ): Promise<Match[]> {
    try {
      // Filter offers by matching resource type
      const typeMatchedOffers = availableOffers.filter(
        (offer) => offer.resourceType === request.resourceType
      );

      if (typeMatchedOffers.length === 0) {
        return [];
      }

      // Calculate distance-based matches if GPS data available
      const offersWithDistance = typeMatchedOffers.map((offer) => {
        let distance: number | undefined;
        
        if (
          request.latitude &&
          request.longitude &&
          offer.latitude &&
          offer.longitude
        ) {
          distance = this.calculateDistance(
            parseFloat(request.latitude),
            parseFloat(request.longitude),
            parseFloat(offer.latitude),
            parseFloat(offer.longitude)
          );
        }

        return { offer, distance };
      });

      const client = getOpenAIClient();
      if (!client) {
        // Fallback to simple distance-based matching
        return offersWithDistance
          .map(({ offer, distance }) => {
            let score = 50; // base score
            
            // Increase score for quantity match
            if (offer.quantity >= request.quantity) {
              score += 20;
            } else {
              score += Math.floor((offer.quantity / request.quantity) * 20);
            }
            
            // Increase score for proximity
            if (distance !== undefined) {
              if (distance < 5) score += 30;
              else if (distance < 20) score += 20;
              else if (distance < 50) score += 10;
            } else {
              score += 10; // slight bonus for same-type match
            }

            return {
              requestId: request.id,
              offerId: offer.id,
              score: Math.min(100, score),
              distance,
              reasoning: `Resource type match. ${
                distance !== undefined
                  ? `Distance: ${distance.toFixed(1)}km.`
                  : ""
              } ${
                offer.quantity >= request.quantity
                  ? "Sufficient quantity available."
                  : "Partial quantity available."
              }`,
            };
          })
          .filter((match) => match.score >= 40) // Only return reasonable matches
          .sort((a, b) => b.score - a.score)
          .slice(0, 5); // Top 5 matches
      }

      // Use AI to determine best matches
      const prompt = `You are an AI matchmaker for disaster relief resources. Analyze the following resource request and available aid offers to find the best matches.

Resource Request:
- Type: ${request.resourceType}
- Quantity needed: ${request.quantity}
- Urgency: ${request.urgency}
- Location: ${request.location}
${request.latitude && request.longitude ? `- GPS: ${request.latitude}, ${request.longitude}` : ""}
- Description: ${request.description || "N/A"}

Available Aid Offers:
${offersWithDistance
  .map(
    ({ offer, distance }, index) => `
${index + 1}. Offer ID: ${offer.id}
   - Type: ${offer.resourceType}
   - Quantity available: ${offer.quantity}
   - Location: ${offer.location}
   ${offer.latitude && offer.longitude ? `- GPS: ${offer.latitude}, ${offer.longitude}` : ""}
   ${distance !== undefined ? `- Distance: ${distance.toFixed(1)} km` : ""}
   - Description: ${offer.description || "N/A"}
`
  )
  .join("\n")}

For each offer, provide a match score (0-100) and reasoning. Consider:
1. Proximity (distance) - closer is better
2. Quantity match - meeting or exceeding need is important
3. Urgency of request vs. availability
4. Any special considerations from descriptions

Respond with a JSON array of matches, sorted by score (highest first). Include only matches with score >= 40.
Format:
[
  {
    "offerId": "offer-id",
    "score": <number 0-100>,
    "reasoning": "<brief explanation>"
  }
]`;

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a disaster relief resource matching AI. Respond only with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const result = JSON.parse(content);
      const matches = (result.matches || []) as Array<{
        offerId: string;
        score: number;
        reasoning: string;
      }>;

      return matches.map((match) => {
        const offerWithDist = offersWithDistance.find(
          ({ offer }) => offer.id === match.offerId
        );
        return {
          requestId: request.id,
          offerId: match.offerId,
          score: Math.max(0, Math.min(100, match.score)),
          distance: offerWithDist?.distance,
          reasoning: match.reasoning,
        };
      });
    } catch (error) {
      logger.error("AI matching error", error as Error);
      // Return empty array on error
      return [];
    }
  }

  /**
   * Find best matches for an aid offer from pending resource requests
   */
  async findMatchesForOffer(
    offer: AidOffer,
    pendingRequests: ResourceRequest[]
  ): Promise<Match[]> {
    // Similar logic but reversed - find requests that match this offer
    const typeMatchedRequests = pendingRequests.filter(
      (request) => request.resourceType === offer.resourceType
    );

    if (typeMatchedRequests.length === 0) {
      return [];
    }

    // Calculate distance-based matches if GPS data available
    const requestsWithDistance = typeMatchedRequests.map((request) => {
      let distance: number | undefined;

      if (
        request.latitude &&
        request.longitude &&
        offer.latitude &&
        offer.longitude
      ) {
        distance = this.calculateDistance(
          parseFloat(offer.latitude),
          parseFloat(offer.longitude),
          parseFloat(request.latitude),
          parseFloat(request.longitude)
        );
      }

      return { request, distance };
    });

    // Simple distance-based matching fallback
    return requestsWithDistance
      .map(({ request, distance }) => {
        let score = 50; // base score

        // Increase score for quantity match
        if (offer.quantity >= request.quantity) {
          score += 20;
        } else {
          score += Math.floor((offer.quantity / request.quantity) * 20);
        }

        // Increase score for urgency
        const urgencyBonus = {
          critical: 15,
          high: 10,
          medium: 5,
          low: 0,
        };
        score += urgencyBonus[request.urgency] || 0;

        // Increase score for proximity
        if (distance !== undefined) {
          if (distance < 5) score += 15;
          else if (distance < 20) score += 10;
          else if (distance < 50) score += 5;
        }

        return {
          requestId: request.id,
          offerId: offer.id,
          score: Math.min(100, score),
          distance,
          reasoning: `${request.urgency} urgency request. ${
            distance !== undefined ? `Distance: ${distance.toFixed(1)}km.` : ""
          } ${
            offer.quantity >= request.quantity
              ? "Offer covers full need."
              : "Offer partially covers need."
          }`,
        };
      })
      .filter((match) => match.score >= 40)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }
}
