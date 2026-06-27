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

const EMERGENCY_PROTOCOLS: Record<string, string> = {
  fire: `FIRE EMERGENCY PROTOCOL:
1. Alert everyone with "FIRE!" and activate the nearest fire alarm
2. Call emergency services immediately (112/911)
3. Evacuate using stairs — never elevators
4. Stay low under smoke, cover mouth/nose with cloth
5. Close doors behind you to slow fire spread
6. Meet at designated assembly point
7. Do NOT re-enter the building
Medical: Treat burns with cool water for 20 minutes. Do NOT use ice, butter, or toothpaste.
Government Guidelines: NDRF guidelines mandate reporting to local fire station and district disaster management authority.`,

  flood: `FLOOD EMERGENCY PROTOCOL:
1. Move immediately to higher ground — do NOT wait
2. Avoid walking or driving through floodwater (6 inches can knock you down)
3. If trapped, move to upper floors/roof and signal for help
4. Turn off utilities at main switches if safe to do so
5. Disconnect electrical appliances
6. Save emergency contacts: NDRF 011-24363260, State helpline
7. Keep emergency kit: water, food, documents in waterproof bag
Medical: Boil or purify all water. Watch for waterborne diseases.
Government Guidelines: Follow district administration evacuation orders immediately.`,

  earthquake: `EARTHQUAKE EMERGENCY PROTOCOL:
1. DROP, COVER, HOLD ON — get under sturdy furniture
2. Stay away from windows, outer walls, heavy objects
3. If outdoors, move away from buildings, trees, power lines
4. If in vehicle, pull over away from bridges/overpasses
5. After shaking stops: check for injuries, gas leaks, structural damage
6. Expect aftershocks — be prepared
7. Do NOT use elevators after earthquake
Medical: Do not move anyone with suspected spinal injury.
Government Guidelines: Report structural damage to municipal corporation. NDRF rescue: 011-24363260`,

  storm: `STORM/CYCLONE EMERGENCY PROTOCOL:
1. Stay indoors away from windows and glass doors
2. Shelter in interior rooms on lowest floor
3. Unplug electronic equipment
4. Have emergency supplies ready: water, food, flashlight, first aid
5. Do NOT go outside during eye of storm — more dangerous winds follow
6. After storm: beware of downed power lines, flooded roads
7. IMD Storm Warning: follow all evacuation advisories
Government Guidelines: India Meteorological Department alerts override local decisions.`,

  road_accident: `ROAD ACCIDENT EMERGENCY PROTOCOL:
1. Call 112 (emergency) or 108 (ambulance) immediately
2. Do NOT move injured persons unless danger of fire/explosion
3. Turn on hazard lights, place warning triangles 50m away
4. Check consciousness and breathing — start CPR if needed
5. Control bleeding with direct pressure, clean cloth
6. Keep victim warm and calm
7. Do NOT give water/food to unconscious persons
Medical: Golden Hour is critical — ensure ambulance arrives within 60 minutes.
Government Guidelines: Good Samaritan Law protects helpers from legal liability.`,

  epidemic: `EPIDEMIC/DISEASE OUTBREAK PROTOCOL:
1. Isolate affected individuals immediately
2. Report to local health authority (District CMO)
3. Maintain hand hygiene — wash with soap for 20 seconds
4. Use PPE (mask, gloves) when near infected persons
5. Avoid sharing utensils, towels, personal items
6. Boil drinking water
7. National Helpline: 1075 (COVID/Epidemic)
Government Guidelines: Mandatory reporting under Epidemic Diseases Act 1897.`,

  landslide: `LANDSLIDE EMERGENCY PROTOCOL:
1. Evacuate immediately if you hear unusual sounds (rumbling, cracking)
2. Move away from slide path — go perpendicular to flow direction
3. Avoid river valleys and low-lying areas below steep slopes
4. After slide: stay away from area — secondary slides possible
5. Watch for flooding following landslides
6. Report to NDRF: 011-24363260
Government Guidelines: GSI (Geological Survey of India) landslide hazard zonation maps guide safe zones.`,

  gas_leak: `GAS LEAK EMERGENCY PROTOCOL:
1. Do NOT turn on/off any electrical switches
2. Extinguish all flames, cigarettes immediately
3. Open doors and windows for ventilation
4. Evacuate the building immediately
5. Call gas company emergency line from OUTSIDE
6. Do NOT use mobile phones inside the building
7. Call fire brigade: 101
Medical: Fresh air for inhalation victims. Seek immediate medical attention.`,

  building_collapse: `BUILDING COLLAPSE PROTOCOL:
1. Call 112 immediately and report exact location
2. Do NOT enter collapsed structure
3. If trapped: tap on pipe/wall — rescue teams listen for sounds
4. Cover mouth with cloth to filter dust
5. Do NOT light a match — gas leaks may be present
6. Signal rescuers with noise, flashlight
7. NDRF Rescue: 011-24363260
Government Guidelines: Urban local body must coordinate with NDRF for rescue operations.`,
};

const LOCAL_EMERGENCY_NUMBERS: Record<string, Record<string, string>> = {
  india: {
    "National Emergency": "112",
    "Police": "100",
    "Fire": "101",
    "Ambulance": "108",
    "NDRF": "011-24363260",
    "Disaster Management": "1078",
    "Health Helpline": "1075",
    "Women Helpline": "1091",
    "Child Helpline": "1098",
  },
  default: {
    "Emergency": "112",
    "Police": "911",
    "Fire": "911",
    "Ambulance": "911",
  },
};

export interface RAGGuidanceResult {
  immediateActions: string[];
  safetyInstructions: string[];
  medicalGuidance: string[];
  governmentGuidelines: string[];
  emergencyNumbers: Record<string, string>;
  multiLanguageSupport: {
    hindi?: string;
    english: string;
  };
  protocol: string;
  sources: string[];
  confidence: number;
}

export class RAGKnowledgeService {
  async getContextualGuidance(
    emergencyType: string,
    severity: string,
    description: string,
    location: string,
    language: "en" | "hi" = "en"
  ): Promise<RAGGuidanceResult> {
    const protocol = EMERGENCY_PROTOCOLS[emergencyType] || EMERGENCY_PROTOCOLS["storm"];
    const emergencyNumbers = LOCAL_EMERGENCY_NUMBERS["india"];

    const baseResult: RAGGuidanceResult = {
      immediateActions: this.extractSection(protocol, "immediate"),
      safetyInstructions: this.extractSection(protocol, "safety"),
      medicalGuidance: this.extractSection(protocol, "medical"),
      governmentGuidelines: this.extractSection(protocol, "government"),
      emergencyNumbers,
      multiLanguageSupport: {
        english: `Emergency: ${emergencyType} - ${severity}. ${description}`,
      },
      protocol: protocol.split("\n")[0],
      sources: ["NDRF Guidelines", "India Disaster Management Act 2005", "National Health Mission"],
      confidence: 0.85,
    };

    const client = getOpenAIClient();
    if (!client) {
      return baseResult;
    }

    try {
      const prompt = `You are a RAG-powered emergency guidance system with access to verified emergency protocols.

Knowledge Base Context:
${protocol}

Emergency Details:
- Type: ${emergencyType}
- Severity: ${severity}
- Location: ${location}
- Description: ${description}

Generate structured emergency guidance. Respond with ONLY valid JSON:
{
  "immediateActions": ["<step 1>", "<step 2>", "<step 3>", "<step 4>", "<step 5>"],
  "safetyInstructions": ["<safety 1>", "<safety 2>", "<safety 3>"],
  "medicalGuidance": ["<medical 1>", "<medical 2>"],
  "governmentGuidelines": ["<guideline 1>", "<guideline 2>"],
  "hindiSummary": "<2-3 sentence summary in Hindi>",
  "keyMessage": "<single most important action to take right now>",
  "confidence": <0.0-1.0>
}`;

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an emergency guidance AI with RAG access to verified protocols. Respond only with valid JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No AI response");

      const aiResult = JSON.parse(content);

      return {
        ...baseResult,
        immediateActions: aiResult.immediateActions || baseResult.immediateActions,
        safetyInstructions: aiResult.safetyInstructions || baseResult.safetyInstructions,
        medicalGuidance: aiResult.medicalGuidance || baseResult.medicalGuidance,
        governmentGuidelines: aiResult.governmentGuidelines || baseResult.governmentGuidelines,
        multiLanguageSupport: {
          english: aiResult.keyMessage || baseResult.multiLanguageSupport.english,
          hindi: aiResult.hindiSummary,
        },
        confidence: aiResult.confidence || 0.85,
      };
    } catch (error) {
      logger.error("RAG guidance error", error as Error);
      return baseResult;
    }
  }

  private extractSection(protocol: string, section: "immediate" | "safety" | "medical" | "government"): string[] {
    const lines = protocol.split("\n").filter(l => l.trim());
    switch (section) {
      case "immediate":
        return lines
          .filter(l => /^\d+\./.test(l.trim()))
          .slice(0, 5)
          .map(l => l.replace(/^\d+\.\s*/, "").trim());
      case "medical":
        return lines
          .filter(l => l.toLowerCase().includes("medical") || l.toLowerCase().includes("treat") || l.toLowerCase().includes("cpr"))
          .map(l => l.trim());
      case "government":
        return lines
          .filter(l => l.toLowerCase().includes("government") || l.toLowerCase().includes("ndrf") || l.toLowerCase().includes("guidelines"))
          .map(l => l.trim());
      default:
        return lines.slice(0, 3).map(l => l.trim());
    }
  }
}
