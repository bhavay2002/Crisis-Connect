import OpenAI from "openai";
import type { DisasterReport } from "@shared/schema";
import { logger } from "../utils/logger";

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

export interface AIValidationResult {
  score: number; // 0-100, where 100 is most credible
  notes: string;
  isDuplicate: boolean;
  isSuspicious: boolean;
}

export class AIValidationService {
  async validateReport(
    newReport: {
      title: string;
      description: string;
      type: string;
      severity: string;
      location: string;
      latitude?: string | null;
      longitude?: string | null;
    },
    existingReports: DisasterReport[]
  ): Promise<AIValidationResult> {
    try {
      const recentReports = existingReports
        .filter(r => {
          // Only check reports from the last 24 hours
          const reportAge = Date.now() - new Date(r.createdAt).getTime();
          return reportAge < 24 * 60 * 60 * 1000;
        })
        .map(r => ({
          type: r.type,
          location: r.location,
          title: r.title,
          description: r.description,
          latitude: r.latitude,
          longitude: r.longitude,
          createdAt: r.createdAt,
        }));

      const prompt = `You are an AI validator for a disaster management system. Analyze this new disaster report and determine:
1. If it appears to be a duplicate of existing reports
2. If it appears suspicious or fake
3. An overall credibility score (0-100)

New Report:
- Type: ${newReport.type}
- Severity: ${newReport.severity}
- Location: ${newReport.location}
${newReport.latitude && newReport.longitude ? `- GPS: ${newReport.latitude}, ${newReport.longitude}` : ''}
- Title: ${newReport.title}
- Description: ${newReport.description}

Recent Reports (last 24 hours):
${recentReports.length > 0 ? JSON.stringify(recentReports, null, 2) : 'No recent reports'}

Respond with a JSON object containing:
{
  "score": <number 0-100>,
  "isDuplicate": <boolean>,
  "isSuspicious": <boolean>,
  "notes": "<explanation of your analysis>"
}

Consider:
- Geographic proximity (if GPS available)
- Similar descriptions or titles
- Timing of reports
- Plausibility of the description
- Type and severity match with description`;

      const client = getOpenAIClient();
      if (!client) {
        logger.warn("OpenAI API key not configured, skipping AI validation");
        return {
          score: 50,
          notes: "AI validation unavailable - API key not configured",
          isDuplicate: false,
          isSuspicious: false,
        };
      }

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a disaster report validation AI. Respond only with valid JSON.",
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

      const result = JSON.parse(content) as AIValidationResult;

      // Ensure score is within bounds
      result.score = Math.max(0, Math.min(100, result.score));

      return result;
    } catch (error) {
      logger.error("AI validation error", error as Error);
      // Return neutral result on error
      return {
        score: 50,
        notes: "Unable to perform AI validation at this time",
        isDuplicate: false,
        isSuspicious: false,
      };
    }
  }
}
