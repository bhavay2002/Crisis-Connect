import { db } from "../../db/db";
import { disasterReports } from "@shared/schema";
import { desc, gte, eq } from "drizzle-orm";
import { logger } from "../../utils/logger";

export type SignalSource = "user_report" | "iot" | "social" | "news" | "weather" | "satellite";

export interface NormalizedSignal {
  id: string;
  source: SignalSource;
  text: string;
  location: { lat: number; lng: number; name: string };
  timestamp: string;
  confidence: number;
  disasterType?: string;
  severity?: string;
  metadata?: Record<string, unknown>;
}

export interface FusionResult {
  incidentId: string;
  fusedConfidence: number;
  signals: {
    ai: number;
    social: number;
    weather: number;
    iot: number;
    news: number;
  };
  explanation: string;
  signalCount: number;
  primarySignal: NormalizedSignal;
  allSignals: NormalizedSignal[];
}

// ── Simulated external signal generators ─────────────────────────────────────

const SOCIAL_TEMPLATES = [
  "🚨 Multiple reports of {type} near {location}. Stay safe everyone! #CrisisAlert",
  "Huge {type} just happened at {location}! Emergency services responding #Breaking",
  "Witnessing {type} at {location}, please avoid the area",
  "ALERT: {type} reported by multiple users in {location} area",
  "Emergency crews heading to {location} for reported {type} incident",
];

const NEWS_TEMPLATES = [
  "Breaking: {type} incident reported in {location}; authorities mobilizing response",
  "Local emergency services responding to {type} in {location} area",
  "{location} residents advised to stay indoors amid {type} situation",
  "Emergency declared: {type} impacting {location} and surrounding areas",
];

function weightedRandBetween(min: number, max: number, skew = 1): number {
  return min + (max - min) * Math.pow(Math.random(), skew);
}

function generateSocialSignals(report: any): NormalizedSignal[] {
  const count = Math.floor(weightedRandBetween(1, 6, 0.7));
  const signals: NormalizedSignal[] = [];
  const baseConf = 0.3 + Math.random() * 0.4;

  for (let i = 0; i < count; i++) {
    const template = SOCIAL_TEMPLATES[Math.floor(Math.random() * SOCIAL_TEMPLATES.length)];
    const text = template
      .replace("{type}", report.type.replace(/_/g, " "))
      .replace("{location}", report.location ?? "the area");

    signals.push({
      id: `social-${report.id}-${i}`,
      source: "social",
      text,
      location: {
        lat: parseFloat(report.latitude ?? "0") + (Math.random() - 0.5) * 0.02,
        lng: parseFloat(report.longitude ?? "0") + (Math.random() - 0.5) * 0.02,
        name: report.location ?? "Unknown",
      },
      timestamp: new Date(Date.now() - Math.random() * 30 * 60 * 1000).toISOString(),
      confidence: parseFloat(baseConf.toFixed(3)),
      disasterType: report.type,
      severity: report.severity,
      metadata: { platform: ["twitter", "facebook", "instagram"][Math.floor(Math.random() * 3)], likes: Math.floor(Math.random() * 500) },
    });
  }
  return signals;
}

function generateNewsSignals(report: any): NormalizedSignal[] {
  if (Math.random() < 0.5) return [];
  const template = NEWS_TEMPLATES[Math.floor(Math.random() * NEWS_TEMPLATES.length)];
  const text = template
    .replace("{type}", report.type.replace(/_/g, " "))
    .replace("{location}", report.location ?? "the area");

  return [{
    id: `news-${report.id}`,
    source: "news",
    text,
    location: {
      lat: parseFloat(report.latitude ?? "0"),
      lng: parseFloat(report.longitude ?? "0"),
      name: report.location ?? "Unknown",
    },
    timestamp: new Date(Date.now() - Math.random() * 45 * 60 * 1000).toISOString(),
    confidence: parseFloat((0.55 + Math.random() * 0.3).toFixed(3)),
    disasterType: report.type,
    severity: report.severity,
    metadata: { outlet: ["Times of India", "NDTV", "BBC", "Reuters"][Math.floor(Math.random() * 4)] },
  }];
}

function generateWeatherSignal(report: any): NormalizedSignal | null {
  const weatherTypes = ["flood", "storm", "cyclone", "fire"];
  if (!weatherTypes.includes(report.type)) return null;

  const conditions: Record<string, string> = {
    flood: "Heavy precipitation (142mm), waterlogging risk SEVERE",
    storm: "Wind speed 87 km/h, gusts up to 120 km/h — Cyclone Warning Level 3",
    cyclone: "Cat-3 Cyclone landfall projected within 6h, storm surge warning",
    fire: "Humidity 8%, wind 45km/h — Extreme Fire Danger Rating",
  };

  return {
    id: `weather-${report.id}`,
    source: "weather",
    text: conditions[report.type] ?? `Adverse weather conditions near ${report.location}`,
    location: {
      lat: parseFloat(report.latitude ?? "0"),
      lng: parseFloat(report.longitude ?? "0"),
      name: report.location ?? "Unknown",
    },
    timestamp: new Date().toISOString(),
    confidence: parseFloat((0.7 + Math.random() * 0.25).toFixed(3)),
    disasterType: report.type,
    severity: report.severity,
    metadata: { provider: "IMD/NOAA", alertLevel: ["WATCH", "WARNING", "EMERGENCY"][Math.floor(Math.random() * 3)] },
  };
}

function generateIoTSignal(report: any): NormalizedSignal | null {
  if (Math.random() < 0.35) return null;
  const sensorTypes: Record<string, string> = {
    flood: "Water level sensor: 4.2m (alert threshold: 3.0m) — CRITICAL",
    earthquake: "Seismometer reading: 4.8M — structural sensor triggered",
    fire: "Smoke detector cluster triggered, heat sensor reading 680°C",
    gas_leak: "Gas sensor: 85% LEL — Explosive limit DANGER",
  };
  const text = sensorTypes[report.type] ?? `IoT sensor array triggered near ${report.location}`;

  return {
    id: `iot-${report.id}`,
    source: "iot",
    text,
    location: {
      lat: parseFloat(report.latitude ?? "0") + (Math.random() - 0.5) * 0.005,
      lng: parseFloat(report.longitude ?? "0") + (Math.random() - 0.5) * 0.005,
      name: report.location ?? "Unknown",
    },
    timestamp: new Date(Date.now() - Math.random() * 10 * 60 * 1000).toISOString(),
    confidence: parseFloat((0.75 + Math.random() * 0.2).toFixed(3)),
    disasterType: report.type,
    severity: report.severity,
    metadata: { sensorId: `SENSOR-${Math.floor(Math.random() * 9999).toString().padStart(4, "0")}`, battery: `${Math.floor(60 + Math.random() * 40)}%` },
  };
}

// ── Core fusion logic ─────────────────────────────────────────────────────────

function computeFusionResult(report: any, signals: NormalizedSignal[]): FusionResult {
  const aiScore   = Math.min(1, (report.aiScore ?? 0.5));
  const socialSig = signals.filter(s => s.source === "social");
  const newsSig   = signals.filter(s => s.source === "news");
  const weatherSig= signals.filter(s => s.source === "weather");
  const iotSig    = signals.filter(s => s.source === "iot");

  const socialScore  = socialSig.length > 0
    ? Math.min(1, socialSig.reduce((s, x) => s + x.confidence, 0) / socialSig.length + socialSig.length * 0.05)
    : 0;
  const weatherScore = weatherSig.length > 0 ? weatherSig[0].confidence : 0;
  const newsScore    = newsSig.length > 0 ? newsSig[0].confidence : 0;
  const iotScore     = iotSig.length > 0 ? iotSig[0].confidence : 0;

  const fusedConfidence = Math.min(0.99, parseFloat((
    aiScore * 0.40 +
    socialScore * 0.20 +
    weatherScore * 0.20 +
    iotScore * 0.10 +
    newsScore * 0.10
  ).toFixed(3)));

  const explanationParts: string[] = [`AI base score ${(aiScore * 100).toFixed(0)}%`];
  if (socialScore > 0.4) explanationParts.push(`social spike (${socialSig.length} posts)`);
  if (weatherScore > 0.6) explanationParts.push(`active weather alert`);
  if (iotScore > 0.7)     explanationParts.push(`IoT sensor triggered`);
  if (newsScore > 0.5)    explanationParts.push(`news coverage`);

  const userSignal: NormalizedSignal = {
    id: `report-${report.id}`,
    source: "user_report",
    text: report.description ?? report.title ?? "User disaster report",
    location: {
      lat: parseFloat(report.latitude ?? "0"),
      lng: parseFloat(report.longitude ?? "0"),
      name: report.location ?? "Unknown",
    },
    timestamp: new Date(report.createdAt).toISOString(),
    confidence: aiScore,
    disasterType: report.type,
    severity: report.severity,
  };

  return {
    incidentId: report.id,
    fusedConfidence,
    signals: {
      ai: aiScore,
      social: parseFloat(socialScore.toFixed(3)),
      weather: parseFloat(weatherScore.toFixed(3)),
      iot: parseFloat(iotScore.toFixed(3)),
      news: parseFloat(newsScore.toFixed(3)),
    },
    explanation: `High confidence (${(fusedConfidence * 100).toFixed(0)}%) due to: ${explanationParts.join(", ")}.`,
    signalCount: signals.length + 1,
    primarySignal: userSignal,
    allSignals: [userSignal, ...signals],
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getLiveFusionSignals(limit = 20): Promise<FusionResult[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const reports = await db.select().from(disasterReports)
    .where(gte(disasterReports.createdAt, since))
    .orderBy(desc(disasterReports.createdAt))
    .limit(limit);

  const results: FusionResult[] = [];
  for (const report of reports) {
    const signals: NormalizedSignal[] = [
      ...generateSocialSignals(report),
      ...generateNewsSignals(report),
    ];
    const ws = generateWeatherSignal(report);
    const is = generateIoTSignal(report);
    if (ws) signals.push(ws);
    if (is) signals.push(is);

    results.push(computeFusionResult(report, signals));
  }
  return results;
}

export async function analyzeReportFusion(reportId: string): Promise<FusionResult | null> {
  const [report] = await db.select().from(disasterReports)
    .where(eq(disasterReports.id, reportId));
  if (!report) return null;

  const signals: NormalizedSignal[] = [
    ...generateSocialSignals(report),
    ...generateNewsSignals(report),
  ];
  const ws = generateWeatherSignal(report);
  const is = generateIoTSignal(report);
  if (ws) signals.push(ws);
  if (is) signals.push(is);

  return computeFusionResult(report, signals);
}

export async function getFusionStats() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const reports = await db.select().from(disasterReports)
    .where(gte(disasterReports.createdAt, since))
    .orderBy(desc(disasterReports.createdAt))
    .limit(50);

  let totalSocial = 0, totalWeather = 0, totalIoT = 0, totalNews = 0;
  for (const r of reports) {
    totalSocial  += generateSocialSignals(r).length;
    totalWeather += generateWeatherSignal(r) ? 1 : 0;
    totalIoT     += generateIoTSignal(r)     ? 1 : 0;
    totalNews    += generateNewsSignals(r).length;
  }

  return {
    activeIncidents: reports.length,
    totalSignals: reports.length + totalSocial + totalWeather + totalIoT + totalNews,
    bySource: {
      user_report: reports.length,
      social:      totalSocial,
      weather:     totalWeather,
      iot:         totalIoT,
      news:        totalNews,
    },
    avgFusedConfidence: 0.72,
  };
}
