import OpenAI from "openai";
import { logger } from "../../utils/logger";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!openai) {
    openai = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openai;
}

export interface UrgencyScore {
  score: number;
  level: "minimal" | "low" | "moderate" | "high" | "critical";
  factors: string[];
}

export interface EmotionAnalysis {
  dominantEmotion: "fear" | "panic" | "calm" | "desperate" | "urgent" | "neutral";
  intensity: number;
  isDistressed: boolean;
}

export interface IntentAnalysis {
  isGenuineEmergency: boolean;
  isCasualMention: boolean;
  isTestReport: boolean;
  confidence: number;
}

export interface ExplainableAIDecision {
  triggered: boolean;
  confidence: number;
  contributingFactors: Array<{
    factor: string;
    weight: number;
    description: string;
  }>;
  reasoning: string;
  auditId: string;
  timestamp: string;
  modelVersion: string;
}

export interface MultiSignalAnalysisResult {
  urgencyScore: UrgencyScore;
  emotionAnalysis: EmotionAnalysis;
  intentAnalysis: IntentAnalysis;
  crisisClassification: {
    type: string;
    subtype: string;
    confidence: number;
  };
  fakeDetection: {
    score: number;
    isSuspicious: boolean;
    reasons: string[];
  };
  explainableDecision: ExplainableAIDecision;
  recommendations: string[];
  rawScore: number;
}

function generateAuditId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ruleBasedAnalysis(input: {
  text: string;
  type: string;
  severity: string;
  location: string;
}): MultiSignalAnalysisResult {
  const text = input.text.toLowerCase();
  const urgencyFactors: string[] = [];
  let urgencyRaw = 0;

  if (input.severity === "critical") { urgencyRaw += 40; urgencyFactors.push("critical severity level"); }
  else if (input.severity === "high") { urgencyRaw += 30; urgencyFactors.push("high severity level"); }
  else if (input.severity === "medium") { urgencyRaw += 20; urgencyFactors.push("medium severity level"); }
  else { urgencyRaw += 5; }

  const urgencyWords = ["help", "urgent", "emergency", "dying", "trapped", "fire", "flood", "danger", "immediate", "now", "sos", "critical"];
  urgencyWords.forEach(w => { if (text.includes(w)) { urgencyRaw += 5; urgencyFactors.push(`urgent keyword: "${w}"`); } });

  const urgencyNorm = Math.min(10, urgencyRaw / 10);
  const urgencyLevel = urgencyNorm >= 8 ? "critical" : urgencyNorm >= 6 ? "high" : urgencyNorm >= 4 ? "moderate" : urgencyNorm >= 2 ? "low" : "minimal";

  const panicWords = ["help", "please", "dying", "trapped", "sos", "emergency"];
  const isPanic = panicWords.some(w => text.includes(w));
  const isCalm = text.length > 100 && !isPanic;
  const emotionDominant = isPanic ? "panic" : isCalm ? "calm" : "urgent";

  const testPhrases = ["test", "testing", "fake", "just checking", "not real"];
  const isTest = testPhrases.some(p => text.includes(p));
  const isCasual = text.length < 30;

  const auditId = generateAuditId();

  return {
    urgencyScore: {
      score: Math.round(urgencyNorm * 10) / 10,
      level: urgencyLevel as any,
      factors: urgencyFactors,
    },
    emotionAnalysis: {
      dominantEmotion: emotionDominant as any,
      intensity: Math.min(1, urgencyNorm / 10),
      isDistressed: urgencyNorm >= 6,
    },
    intentAnalysis: {
      isGenuineEmergency: !isTest && !isCasual,
      isCasualMention: isCasual,
      isTestReport: isTest,
      confidence: 0.6,
    },
    crisisClassification: {
      type: input.type,
      subtype: "general",
      confidence: 0.7,
    },
    fakeDetection: {
      score: isTest ? 80 : isCasual ? 40 : 10,
      isSuspicious: isTest,
      reasons: isTest ? ["test keywords detected"] : [],
    },
    explainableDecision: {
      triggered: urgencyNorm >= 5,
      confidence: 0.6,
      contributingFactors: urgencyFactors.map(f => ({ factor: f, weight: 0.1, description: f })),
      reasoning: `Rule-based analysis: urgency ${urgencyLevel}, emotion ${emotionDominant}.`,
      auditId,
      timestamp: new Date().toISOString(),
      modelVersion: "rules-1.0",
    },
    recommendations: ["Verify location", "Contact emergency services if confirmed"],
    rawScore: urgencyRaw,
  };
}

export class CrisisIntelligenceService {
  async analyzeMultiSignal(input: {
    text: string;
    type: string;
    severity: string;
    location: string;
    latitude?: string;
    longitude?: string;
    imageUrls?: string[];
    userId?: string;
  }): Promise<MultiSignalAnalysisResult> {
    const client = getOpenAIClient();
    const auditId = generateAuditId();

    if (!client) {
      logger.warn("OpenAI not configured, using rule-based crisis analysis");
      return ruleBasedAnalysis(input);
    }

    try {
      const prompt = `You are an advanced crisis intelligence AI for a disaster management system.
Perform multi-signal analysis on the following crisis report:

Report Type: ${input.type}
Severity: ${input.severity}
Location: ${input.location}
${input.latitude ? `GPS: ${input.latitude}, ${input.longitude}` : ""}
Text: "${input.text}"
${input.imageUrls?.length ? `Images attached: ${input.imageUrls.length}` : ""}

Analyze and respond with ONLY valid JSON matching this schema exactly:
{
  "urgencyScore": {
    "score": <0.0-10.0 float>,
    "level": "<minimal|low|moderate|high|critical>",
    "factors": ["<factor1>", "<factor2>"]
  },
  "emotionAnalysis": {
    "dominantEmotion": "<fear|panic|calm|desperate|urgent|neutral>",
    "intensity": <0.0-1.0>,
    "isDistressed": <boolean>
  },
  "intentAnalysis": {
    "isGenuineEmergency": <boolean>,
    "isCasualMention": <boolean>,
    "isTestReport": <boolean>,
    "confidence": <0.0-1.0>
  },
  "crisisClassification": {
    "type": "<specific disaster type>",
    "subtype": "<specific subtype e.g. structural_fire, flash_flood>",
    "confidence": <0.0-1.0>
  },
  "fakeDetection": {
    "score": <0-100>,
    "isSuspicious": <boolean>,
    "reasons": ["<reason if suspicious>"]
  },
  "explainableDecision": {
    "triggered": <boolean - is this a real emergency?>,
    "confidence": <0.0-1.0>,
    "contributingFactors": [
      {"factor": "<name>", "weight": <0.0-1.0>, "description": "<why this matters>"}
    ],
    "reasoning": "<2-3 sentence explanation of why this alert was or wasn't triggered>",
    "auditId": "${auditId}",
    "timestamp": "${new Date().toISOString()}",
    "modelVersion": "gpt-4o-mini-2.0"
  },
  "recommendations": ["<action1>", "<action2>"],
  "rawScore": <0-100>
}`;

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a crisis intelligence AI. Respond only with valid JSON, no markdown." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No response from AI");

      const result = JSON.parse(content) as MultiSignalAnalysisResult;
      result.explainableDecision.auditId = auditId;
      result.explainableDecision.timestamp = new Date().toISOString();

      logger.info("Multi-signal crisis analysis completed", {
        auditId,
        urgencyLevel: result.urgencyScore.level,
        isGenuine: result.intentAnalysis.isGenuineEmergency,
        fakeScore: result.fakeDetection.score,
      });

      return result;
    } catch (error) {
      logger.error("Crisis intelligence analysis error", error as Error);
      return ruleBasedAnalysis(input);
    }
  }

  async detectEarlyWarning(reports: Array<{
    type: string;
    location: string;
    latitude?: string | null;
    longitude?: string | null;
    createdAt: Date;
    severity: string;
  }>): Promise<{
    warningDetected: boolean;
    area: string;
    disasterType: string;
    confidence: number;
    message: string;
    affectedReports: number;
  } | null> {
    if (reports.length < 3) return null;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentReports = reports.filter(r => new Date(r.createdAt) > oneHourAgo);

    if (recentReports.length < 3) return null;

    const typeCounts: Record<string, number> = {};
    recentReports.forEach(r => {
      typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
    });

    const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    if (!dominantType || dominantType[1] < 3) return null;

    const criticalCount = recentReports.filter(r => r.severity === "critical" || r.severity === "high").length;
    const confidence = Math.min(0.95, 0.5 + (dominantType[1] / recentReports.length) * 0.3 + (criticalCount / recentReports.length) * 0.2);

    return {
      warningDetected: true,
      area: recentReports[0].location,
      disasterType: dominantType[0],
      confidence,
      message: `Early warning: ${dominantType[1]} ${dominantType[0]} reports in the last hour. Potential crisis forming.`,
      affectedReports: dominantType[1],
    };
  }
}
