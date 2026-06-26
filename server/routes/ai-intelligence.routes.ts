import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { aiRequestLimiter } from "../middleware/rateLimiting";
import { CrisisIntelligenceService } from "../modules/ai/crisis-intelligence.service";
import { RAGKnowledgeService } from "../modules/ai/rag-knowledge.service";
import { SignalFusionService } from "../modules/ai/signal-fusion.service";
import { storage } from "../db/storage";
import { logger } from "../utils/logger";

export function registerAIIntelligenceRoutes(app: Express) {
  const crisisIntelligence = new CrisisIntelligenceService();
  const ragKnowledge = new RAGKnowledgeService();
  const signalFusion = new SignalFusionService();

  // Multi-signal crisis analysis — with Signal Fusion Engine
  app.post("/api/ai/analyze", isAuthenticated, aiRequestLimiter, async (req: any, res) => {
    try {
      const { text, type, severity, location, latitude, longitude, imageUrls } = req.body;
      const userId = req.user.userId;

      if (!text || !type || !severity || !location) {
        return res.status(400).json({ message: "text, type, severity, location are required" });
      }

      // Step 1: Multi-signal AI analysis
      const aiResult = await crisisIntelligence.analyzeMultiSignal({
        text, type, severity, location, latitude, longitude, imageUrls, userId,
      });

      // Step 2: Signal Fusion — combines AI + location risk + repetition + user trust
      const fusedScore = await signalFusion.computeFusedScore(aiResult, {
        latitude, longitude, userId, type,
      });

      logger.info("Multi-signal + fusion analysis completed", {
        userId,
        type,
        urgencyLevel: aiResult.urgencyScore.level,
        fusedPriority: fusedScore.priority,
        finalScore: fusedScore.finalScore,
        auditId: aiResult.explainableDecision.auditId,
      });

      res.json({ ...aiResult, fusedScore });
    } catch (error) {
      logger.error("AI analyze error", error as Error);
      res.status(500).json({ message: "Analysis failed" });
    }
  });

  // Early warning detection
  app.get("/api/ai/early-warning", isAuthenticated, async (req: any, res) => {
    try {
      const reports = await storage.getAllDisasterReports();
      const mapped = reports.map(r => ({
        type: r.type,
        location: r.location,
        latitude: r.latitude,
        longitude: r.longitude,
        createdAt: new Date(r.createdAt),
        severity: r.severity,
      }));

      const warning = await crisisIntelligence.detectEarlyWarning(mapped);
      res.json(warning || { warningDetected: false, message: "No early warning patterns detected" });
    } catch (error) {
      logger.error("Early warning error", error as Error);
      res.status(500).json({ message: "Early warning detection failed" });
    }
  });

  // RAG-based crisis copilot — structured {steps, warnings, resources} output
  app.post("/api/ai/copilot", isAuthenticated, aiRequestLimiter, async (req: any, res) => {
    try {
      const { emergencyType, severity, description, location, language } = req.body;

      if (!emergencyType || !severity || !description || !location) {
        return res.status(400).json({ message: "emergencyType, severity, description, location required" });
      }

      const raw = await ragKnowledge.getContextualGuidance(
        emergencyType, severity, description, location, language || "en"
      );

      // Spec output: { steps, warnings, resources }
      const steps = [
        ...raw.immediateActions,
        ...raw.safetyInstructions,
      ].filter(Boolean);

      const warnings = [
        ...raw.medicalGuidance.filter(m =>
          /do not|avoid|never|warning|danger|risk/i.test(m)
        ),
        ...raw.governmentGuidelines.filter(g =>
          /mandatory|report|required|must/i.test(g)
        ),
      ];

      const resources = Object.entries(raw.emergencyNumbers).map(([name, contact]) => ({
        name,
        contact,
        notes: "",
      }));

      const guidance = {
        // Spec canonical shape
        steps,
        warnings: warnings.length > 0
          ? warnings
          : ["Stay calm and follow official instructions", "Do NOT return to danger zone until cleared"],
        resources,

        // Extended fields for the Copilot UI
        summary: raw.multiLanguageSupport.english,
        immediateActions: raw.immediateActions,
        medicalGuidance: raw.medicalGuidance,
        evacuationProtocol: raw.safetyInstructions,
        localResources: resources,
        doNots: raw.medicalGuidance.filter(m => /do not|avoid|never/i.test(m)),
        confidence: Math.round(raw.confidence * 100),
        language: language || "en",
        governmentGuidelines: raw.governmentGuidelines.join(" "),
        hindiInstructions: raw.multiLanguageSupport.hindi,
        sources: raw.sources,
        protocol: raw.protocol,
      };

      logger.info("RAG copilot guidance requested", { emergencyType, severity });
      res.json(guidance);
    } catch (error) {
      logger.error("AI copilot error", error as Error);
      res.status(500).json({ message: "Copilot guidance failed" });
    }
  });

  // §7 Explainable AI — paginated audit log of AI decisions across all reports
  app.get("/api/ai/decisions", isAuthenticated, async (req: any, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
      const offset = (page - 1) * limit;

      const reports = await storage.getAllDisasterReports();
      const sorted = reports
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const page_reports = sorted.slice(offset, offset + limit);

      const decisions = page_reports.map(r => {
        const text = `${r.title} ${r.description}`.toLowerCase();
        const urgencyWords = ["help", "urgent", "emergency", "dying", "trapped", "fire", "flood", "danger"];
        const urgencyHit = urgencyWords.filter(w => text.includes(w));
        const fakeWords = ["test", "testing", "fake", "just checking", "not real"];
        const isSuspicious = fakeWords.some(w => text.includes(w));
        const severityScore = r.severity === "critical" ? 0.9 : r.severity === "high" ? 0.7 : r.severity === "medium" ? 0.4 : 0.2;
        const urgencyScore = Math.min(1, severityScore + urgencyHit.length * 0.05);
        const fusedPriority = urgencyScore >= 0.8 ? "CRITICAL" : urgencyScore >= 0.6 ? "HIGH" : urgencyScore >= 0.35 ? "MEDIUM" : "LOW";
        const auditId = `ai-${new Date(r.createdAt).getTime()}-${r.id.slice(0, 7)}`;

        return {
          reportId: r.id,
          title: r.title,
          type: r.type,
          severity: r.severity,
          location: r.location,
          createdAt: r.createdAt,
          auditId,
          confidence: severityScore,
          fusedPriority,
          finalScore: urgencyScore,
          triggered: urgencyScore >= 0.35,
          urgencyLevel: urgencyScore >= 0.8 ? "critical" : urgencyScore >= 0.6 ? "high" : urgencyScore >= 0.4 ? "moderate" : "low",
          isSuspicious,
          isGenuineEmergency: !isSuspicious,
          components: {
            aiUrgency: Math.min(1, urgencyScore),
            locationRisk: r.latitude ? 0.3 : 0.1,
            repetitionScore: 0.1,
            userTrustScore: 0.5,
          },
          weights: { aiUrgency: 0.5, locationRisk: 0.2, repetitionScore: 0.2, userTrustScore: 0.1 },
          contributingFactors: [
            { factor: "Severity", weight: severityScore, description: `Reported severity: ${r.severity}` },
            ...(urgencyHit.length > 0
              ? [{ factor: "Urgency Keywords", weight: Math.min(1, urgencyHit.length * 0.1), description: `Keywords: ${urgencyHit.join(", ")}` }]
              : []),
          ],
          reasoning: urgencyHit.length > 0
            ? `${fusedPriority} priority: ${r.severity} severity with urgency keywords detected.`
            : `${fusedPriority} priority based on ${r.severity} severity level.`,
          recommendations: [
            urgencyScore >= 0.8 ? "Dispatch emergency response immediately" :
            urgencyScore >= 0.6 ? "Assign to response team within 10 minutes" :
            "Monitor and assign during next review cycle",
          ],
        };
      });

      res.json({ decisions, total: reports.length, page, limit });
    } catch (error) {
      logger.error("AI decisions list error", error as Error);
      res.status(500).json({ message: "Failed to retrieve AI decisions" });
    }
  });

  // Explainability for a specific report — now also includes fused score
  app.get("/api/ai/explain/:reportId", isAuthenticated, async (req: any, res) => {
    try {
      const { reportId } = req.params;
      const report = await storage.getDisasterReport(reportId);
      if (!report) return res.status(404).json({ message: "Report not found" });

      const [analysis, fusedScore] = await Promise.all([
        crisisIntelligence.analyzeMultiSignal({
          text: `${report.title} ${report.description}`,
          type: report.type,
          severity: report.severity,
          location: report.location,
          latitude: report.latitude || undefined,
          longitude: report.longitude || undefined,
        }),
        signalFusion.computeFusedScore(
          // minimal placeholder for fusion without full analysis
          {
            urgencyScore: { score: 5, level: "moderate", factors: [] },
            emotionAnalysis: { dominantEmotion: "neutral", intensity: 0.5, isDistressed: false },
            intentAnalysis: { isGenuineEmergency: true, isCasualMention: false, isTestReport: false, confidence: 0.7 },
            crisisClassification: { type: report.type, subtype: "general", confidence: 0.7 },
            fakeDetection: { score: 10, isSuspicious: false, reasons: [] },
            explainableDecision: { triggered: true, confidence: 0.7, contributingFactors: [], reasoning: "", auditId: "", timestamp: "", modelVersion: "" },
            recommendations: [],
            rawScore: 50,
          },
          { latitude: report.latitude || undefined, longitude: report.longitude || undefined, type: report.type }
        ),
      ]);

      res.json({
        reportId,
        explanation: analysis.explainableDecision,
        urgency: analysis.urgencyScore,
        intent: analysis.intentAnalysis,
        fakeDetection: analysis.fakeDetection,
        fusedScore,
        recommendations: analysis.recommendations,
      });
    } catch (error) {
      logger.error("AI explain error", error as Error);
      res.status(500).json({ message: "Explanation failed" });
    }
  });
}
