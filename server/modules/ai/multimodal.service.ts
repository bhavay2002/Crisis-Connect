import OpenAI from "openai";
import { logger } from "../../utils/logger";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) return null;
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openai;
}

export interface MultimodalInput {
  text?: string;
  voiceTranscript?: string;
  imageUrl?: string;
  location?: string;
}

export interface MultimodalResult {
  crisisType: string;
  urgency: number;
  confidence: number;
  severity: "low" | "medium" | "high" | "critical";
  explanation: string;
  fusionScores: { text: number; voice: number; image: number };
  fusedScore: number;
  requiresHumanReview: boolean;
  source: "ai" | "heuristic";
}

// Heuristic analysis when OpenAI is not available
function heuristicAnalysis(input: MultimodalInput): MultimodalResult {
  const combined = [input.text, input.voiceTranscript].filter(Boolean).join(" ").toLowerCase();
  const crisisKeywords: Record<string, { type: string; urgency: number }> = {
    fire: { type: "fire", urgency: 0.9 }, flood: { type: "flood", urgency: 0.85 },
    earthquake: { type: "earthquake", urgency: 0.95 }, accident: { type: "road_accident", urgency: 0.8 },
    collapse: { type: "building_collapse", urgency: 0.95 }, gas: { type: "gas_leak", urgency: 0.85 },
    medical: { type: "epidemic", urgency: 0.75 }, storm: { type: "storm", urgency: 0.7 },
    landslide: { type: "landslide", urgency: 0.8 }, chemical: { type: "chemical_spill", urgency: 0.85 },
  };
  let bestMatch = { type: "other", urgency: 0.5 };
  for (const [kw, meta] of Object.entries(crisisKeywords)) {
    if (combined.includes(kw)) { bestMatch = meta; break; }
  }
  const textScore = input.text ? Math.min(0.4 + (input.text.length / 500), 0.8) : 0;
  const voiceScore = input.voiceTranscript ? Math.min(0.35 + (input.voiceTranscript.length / 400), 0.75) : 0;
  const imageScore = input.imageUrl ? 0.6 : 0;
  const fusedScore = 0.4 * textScore + 0.3 * voiceScore + 0.3 * imageScore;
  const urgency = fusedScore > 0 ? Math.min(bestMatch.urgency, fusedScore * 1.2) : bestMatch.urgency;
  const severity = urgency >= 0.85 ? "critical" : urgency >= 0.7 ? "high" : urgency >= 0.5 ? "medium" : "low";
  return {
    crisisType: bestMatch.type,
    urgency: parseFloat(urgency.toFixed(2)),
    confidence: 0.65,
    severity,
    explanation: `Heuristic analysis: detected '${bestMatch.type}' from keyword matching. ${input.imageUrl ? "Image signal included. " : ""}${input.voiceTranscript ? "Voice transcript analyzed." : ""}`,
    fusionScores: { text: parseFloat(textScore.toFixed(2)), voice: parseFloat(voiceScore.toFixed(2)), image: parseFloat(imageScore.toFixed(2)) },
    fusedScore: parseFloat(fusedScore.toFixed(2)),
    requiresHumanReview: urgency >= 0.85 || severity === "critical",
    source: "heuristic",
  };
}

export async function analyzeMultimodal(input: MultimodalInput): Promise<MultimodalResult> {
  const ai = getOpenAI();

  if (!ai) {
    logger.warn("[Multimodal] OpenAI not configured — using heuristic analysis");
    return heuristicAnalysis(input);
  }

  try {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    const systemPrompt = `You are a multimodal crisis intelligence system for CrisisConnect emergency platform.
Analyze ALL provided signals together (text, voice transcript, image) and return a JSON response.

Return ONLY this exact JSON structure (no markdown, no explanation outside JSON):
{
  "crisis_type": "fire|flood|earthquake|storm|road_accident|epidemic|landslide|gas_leak|building_collapse|chemical_spill|power_outage|other",
  "urgency": 0.0-1.0,
  "confidence": 0.0-1.0,
  "severity": "low|medium|high|critical",
  "explanation": "brief analysis of all signals",
  "text_signal_score": 0.0-1.0,
  "voice_signal_score": 0.0-1.0,
  "image_signal_score": 0.0-1.0
}`;

    const userContent: OpenAI.ChatCompletionContentPart[] = [];
    let promptText = "Analyze this crisis report:\n\n";
    if (input.text) promptText += `TEXT SIGNAL: "${input.text}"\n\n`;
    if (input.voiceTranscript) promptText += `VOICE TRANSCRIPT: "${input.voiceTranscript}"\n\n`;
    if (input.location) promptText += `LOCATION: ${input.location}\n\n`;
    if (!input.imageUrl) promptText += "(No image provided)";
    userContent.push({ type: "text", text: promptText });

    if (input.imageUrl) {
      userContent.push({ type: "image_url", image_url: { url: input.imageUrl, detail: "low" } });
    }

    messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: userContent });

    const response = await ai.chat.completions.create({
      model: input.imageUrl ? "gpt-4o" : "gpt-4o-mini",
      messages,
      max_tokens: 400,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "{}";
    const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, ""));

    const textScore = parseFloat(parsed.text_signal_score ?? "0");
    const voiceScore = parseFloat(parsed.voice_signal_score ?? "0");
    const imageScore = parseFloat(parsed.image_signal_score ?? "0");
    const fusedScore = parseFloat((0.4 * textScore + 0.3 * voiceScore + 0.3 * imageScore).toFixed(2));
    const urgency = parseFloat(parsed.urgency ?? "0.5");
    const confidence = parseFloat(parsed.confidence ?? "0.7");

    logger.info("[Multimodal] AI analysis complete", { crisisType: parsed.crisis_type, urgency, confidence });

    return {
      crisisType: parsed.crisis_type || "other",
      urgency,
      confidence,
      severity: parsed.severity || (urgency >= 0.85 ? "critical" : urgency >= 0.7 ? "high" : urgency >= 0.5 ? "medium" : "low"),
      explanation: parsed.explanation || "AI analysis complete",
      fusionScores: { text: textScore, voice: voiceScore, image: imageScore },
      fusedScore,
      requiresHumanReview: confidence < 0.7 || urgency >= 0.85 || parsed.severity === "critical",
      source: "ai",
    };
  } catch (err) {
    logger.error("[Multimodal] AI analysis failed — falling back to heuristic", err instanceof Error ? err : undefined);
    return heuristicAnalysis(input);
  }
}
