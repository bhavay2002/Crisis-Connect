import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { analyzeMultimodal } from "../modules/ai/multimodal.service";
import { db } from "../db/db";
import { aiOverrides, disasterReports } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger";

export function registerMultimodalRoutes(app: Express) {
  // Core multimodal analysis endpoint
  app.post("/api/ai/multimodal-analyze", isAuthenticated, async (req: any, res) => {
    try {
      const { text, voiceTranscript, imageUrl, location, saveAsOverride, incidentId } = req.body;

      if (!text && !voiceTranscript && !imageUrl) {
        return res.status(400).json({ message: "At least one of text, voiceTranscript, or imageUrl is required" });
      }

      const result = await analyzeMultimodal({ text, voiceTranscript, imageUrl, location });

      // Optionally persist as an AI override record for human review
      if (saveAsOverride && incidentId) {
        await db.insert(aiOverrides).values({
          incidentId,
          incidentType: "disaster_report",
          originalDecision: {
            crisisType: result.crisisType,
            urgency: result.urgency,
            confidence: result.confidence,
            severity: result.severity,
          },
          aiConfidence: String(result.confidence),
          aiUrgency: String(result.urgency),
          requiresHumanReview: result.requiresHumanReview,
          status: result.requiresHumanReview ? "pending_review" : "auto_approved",
        });
      }

      res.json(result);
    } catch (err) {
      logger.error("Multimodal analysis failed", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Analysis failed" });
    }
  });

  // Batch analyze multiple reports
  app.post("/api/ai/multimodal-batch", isAuthenticated, async (req: any, res) => {
    try {
      const { inputs } = req.body;
      if (!Array.isArray(inputs) || inputs.length === 0) {
        return res.status(400).json({ message: "inputs array is required" });
      }
      if (inputs.length > 5) {
        return res.status(400).json({ message: "Maximum 5 items per batch" });
      }
      const results = await Promise.all(inputs.map((inp: any) => analyzeMultimodal(inp)));
      res.json({ results, count: results.length });
    } catch (err) {
      res.status(500).json({ message: "Batch analysis failed" });
    }
  });

  // Get fusion weight explanation
  app.get("/api/ai/multimodal-info", isAuthenticated, (req, res) => {
    res.json({
      fusionWeights: { text: 0.4, voice: 0.3, image: 0.3 },
      humanReviewTriggers: [
        "AI confidence < 0.70",
        "Urgency score ≥ 0.85",
        "Severity classified as critical",
      ],
      supportedCrisisTypes: [
        "fire", "flood", "earthquake", "storm", "road_accident",
        "epidemic", "landslide", "gas_leak", "building_collapse",
        "chemical_spill", "power_outage", "water_contamination", "other",
      ],
      model: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? "gpt-4o (vision + text)" : "heuristic (OpenAI not configured)",
    });
  });
}
