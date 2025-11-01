import OpenAI from "openai";
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

export interface AICrisisGuidanceResult {
  response: string;
  suggestions: string[];
  resources: string[];
}

export class AICrisisGuidanceService {
  async getCrisisGuidance(
    emergencyType: string,
    severity: string,
    description: string,
    location: string
  ): Promise<AICrisisGuidanceResult> {
    try {
      const prompt = `You are an AI crisis response assistant for a disaster management system. A person is experiencing an emergency and needs immediate guidance.

Emergency Details:
- Type: ${emergencyType}
- Severity: ${severity}
- Location: ${location}
- Description: ${description}

Provide:
1. Immediate safety advice and actions to take
2. Practical suggestions for this specific emergency
3. Resources or organizations that can help

Respond with a JSON object containing:
{
  "response": "<clear, actionable safety advice in 2-3 paragraphs>",
  "suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"],
  "resources": ["<resource/organization 1>", "<resource/organization 2>"]
}

Keep advice:
- Clear and actionable
- Appropriate for the severity level
- Specific to the emergency type
- Focused on immediate safety
- Professional and reassuring`;

      const client = getOpenAIClient();
      if (!client) {
        logger.warn("OpenAI API key not configured, providing default crisis guidance");
        return {
          response: "Emergency services have been notified. Please stay calm and follow basic safety protocols for your situation. Help is on the way.",
          suggestions: [
            "Move to a safe location if possible",
            "Stay calm and assess your immediate surroundings",
            "Contact emergency services if you haven't already"
          ],
          resources: [
            "Local emergency services: 911",
            "Disaster relief organizations in your area",
            "Community emergency response teams"
          ]
        };
      }

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a crisis response AI assistant. Provide clear, actionable safety advice. Respond only with valid JSON.",
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

      const result = JSON.parse(content) as AICrisisGuidanceResult;
      return result;
    } catch (error) {
      logger.error("AI crisis guidance error", error as Error);
      return {
        response: "Emergency services have been notified. Please stay calm and follow basic safety protocols. Help is on the way.",
        suggestions: [
          "Move to a safe location if possible",
          "Stay calm and assess your immediate surroundings",
          "Contact emergency services if available"
        ],
        resources: [
          "Local emergency services",
          "Community support organizations"
        ]
      };
    }
  }

  async getChatGuidance(
    conversationContext: string,
    userQuestion: string
  ): Promise<string> {
    try {
      const prompt = `You are a helpful AI assistant in a disaster management chat system. Provide helpful, accurate information about crisis management, safety protocols, and emergency response.

Conversation Context:
${conversationContext}

User Question:
${userQuestion}

Provide a helpful, concise response focused on:
- Safety and well-being
- Practical advice
- Crisis management best practices
- Resource availability

Keep your response clear, empathetic, and actionable (2-3 paragraphs maximum).`;

      const client = getOpenAIClient();
      if (!client) {
        return "I'm currently unable to provide AI assistance. Please consult with emergency responders or local authorities for guidance.";
      }

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful crisis management AI assistant. Provide clear, empathetic, and actionable advice.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      return content || "I'm unable to provide a response at this time. Please consult with emergency responders for guidance.";
    } catch (error) {
      logger.error("AI chat guidance error", error as Error);
      return "I'm experiencing technical difficulties. Please consult with emergency responders or local authorities for guidance.";
    }
  }
}
