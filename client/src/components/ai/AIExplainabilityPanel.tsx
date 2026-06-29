/**
 * AIExplainabilityPanel — plug-and-play AI decision intelligence panel.
 *
 * Bloomberg/Datadog visual style: dark, data-dense, sharp.
 * Drop it anywhere — ReportDetails, IncidentPanel, Command Center.
 *
 * Usage:
 *   <AIExplainabilityPanel reportId={report.id} createdAt={report.createdAt} />
 *
 * Fetches /api/ai/explain/:reportId and renders:
 *   1. Confidence meter (animated gradient bar)
 *   2. Priority badge + intent indicator
 *   3. Signal Radar (four-axis fusion chart)
 *   4. Factor Bars (weighted contribution breakdown)
 *   5. Decision Timeline (synthesized reasoning chain)
 *   6. AI Recommendations (collapsible)
 *
 * Real-time: when the `key` changes (new data) the entire panel
 * re-mounts, re-animating all bars and fills for a live feel.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, ChevronDown, ChevronUp, Shield, AlertTriangle,
  CheckCircle, Eye, Zap, Clock, Loader2, Info,
} from "lucide-react";

import { ConfidenceMeter } from "./ConfidenceMeter";
import { SignalRadar }     from "./SignalRadar";
import { FactorBars }      from "./FactorBars";
import { DecisionTimeline, deriveTimeline } from "./DecisionTimeline";

// ── Priority colours (match fintech risk-level convention) ────────────────────
const PRIORITY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  CRITICAL: { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30"    },
  HIGH:     { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  MEDIUM:   { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  LOW:      { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30"  },
};

// ── Section header ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2.5 select-none">
      {children}
    </p>
  );
}

// ── Divider ────────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="border-t border-slate-800 my-4" />;
}

// ── Empty / error states ───────────────────────────────────────────────────────
function PanelEmpty({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="w-8 h-8 text-slate-700 mb-2" />
      <p className="text-xs text-slate-500">{message}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  reportId:  string;
  createdAt: string; // ISO string — used to anchor the decision timeline
  compact?:  boolean; // hide some sections for sidebar embeds
}

export function AIExplainabilityPanel({ reportId, createdAt, compact = false }: Props) {
  const [expanded, setExpanded]         = useState(!compact);
  const [showRecs, setShowRecs]         = useState(false);
  const [activeSection, setActiveSection] = useState<"radar" | "factors" | "timeline">("radar");

  const { data: explain, isLoading, isError } = useQuery({
    queryKey: ["/api/ai/explain", reportId],
    queryFn: () =>
      fetch(`/api/ai/explain/${reportId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      }).then(r => {
        if (!r.ok) throw new Error("No explanation available");
        return r.json();
      }),
    enabled: !!reportId && expanded,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Derive timeline steps from explain data
  const timelineSteps = useMemo(
    () => explain ? deriveTimeline(explain, createdAt) : [],
    [explain, createdAt]
  );

  const priority   = explain?.fusedScore?.priority ?? "UNKNOWN";
  const confidence = explain?.explanation?.confidence ?? explain?.fusedScore?.finalScore ?? 0;
  const prioStyle  = PRIORITY_COLOR[priority] ?? PRIORITY_COLOR.MEDIUM;
  const recommendations: string[] = explain?.recommendations ?? [];

  const fusionComponents = explain?.fusedScore?.components
    ? {
        aiUrgency:       explain.fusedScore.components.aiUrgency       ?? 0,
        locationRisk:    explain.fusedScore.components.locationRisk     ?? 0,
        repetitionScore: explain.fusedScore.components.repetitionScore  ?? 0,
        userTrustScore:  explain.fusedScore.components.userTrustScore   ?? 0,
      }
    : null;

  const factors = (explain?.explanation?.contributingFactors ?? []) as Array<{
    factor: string; weight: number; description?: string;
  }>;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden">
      {/* ── Header ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-900/60 transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
          <Brain className="w-3.5 h-3.5 text-red-500" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-black text-slate-200 uppercase tracking-wide">AI Analysis</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Signal fusion · Decision reasoning · Explainability
          </p>
        </div>
        {!isLoading && explain && (
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black border ${prioStyle.bg} ${prioStyle.border} ${prioStyle.text}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
            {priority}
          </div>
        )}
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
      </button>

      {/* ── Collapsible body ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-800 px-4 py-4">
              {/* ── Loading ── */}
              {isLoading && (
                <div className="flex items-center gap-2 py-6 justify-center text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Running AI analysis…</span>
                </div>
              )}

              {/* ── Error ── */}
              {isError && (
                <PanelEmpty icon={Info} message="No AI analysis available for this report yet." />
              )}

              {/* ── Content ── */}
              {explain && (
                <motion.div
                  key={reportId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* ─── 1. Confidence meter ─── */}
                  <ConfidenceMeter value={confidence} animate />

                  {/* ─── 2. Status row ─── */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {/* Priority */}
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border ${prioStyle.bg} ${prioStyle.border} ${prioStyle.text}`}>
                      <Zap className="w-3 h-3" />{priority}
                    </div>
                    {/* Intent */}
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border ${
                      explain.intent?.isGenuineEmergency
                        ? "bg-green-500/10 border-green-500/20 text-green-400"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}>
                      <Shield className="w-3 h-3" />
                      {explain.intent?.isGenuineEmergency ? "Genuine" : "Unverified"}
                    </div>
                    {/* Fake detection */}
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border ${
                      explain.fakeDetection?.isSuspicious
                        ? "bg-red-500/10 border-red-500/30 text-red-400"
                        : "bg-green-500/10 border-green-500/20 text-green-400"
                    }`}>
                      <Eye className="w-3 h-3" />
                      {explain.fakeDetection?.isSuspicious ? "Suspicious" : "Authentic"}
                    </div>
                    {/* Triggered */}
                    {explain.explanation?.triggered && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border bg-orange-500/10 border-orange-500/20 text-orange-400">
                        <AlertTriangle className="w-3 h-3" />Alert Triggered
                      </div>
                    )}
                  </div>

                  <Divider />

                  {/* ─── 3. Tabbed sections ─── */}
                  <div className="flex gap-1 mb-4">
                    {(["radar", "factors", "timeline"] as const).map(s => (
                      <button key={s} onClick={() => setActiveSection(s)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize transition-colors ${
                          activeSection === s
                            ? "bg-red-500/15 text-red-400 border border-red-500/25"
                            : "text-slate-500 hover:text-slate-300"
                        }`}>
                        {s === "radar" ? "Signals" : s === "factors" ? "Factors" : "Timeline"}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    {/* Signal Radar */}
                    {activeSection === "radar" && fusionComponents && (
                      <motion.div key="radar"
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <SectionLabel>Signal Fusion — how each source contributed</SectionLabel>
                        <SignalRadar components={fusionComponents} />

                        {/* Component value strip */}
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {[
                            { label: "AI Urgency",  value: fusionComponents.aiUrgency,       weight: "50% weight" },
                            { label: "Location",    value: fusionComponents.locationRisk,     weight: "20% weight" },
                            { label: "Repetition",  value: fusionComponents.repetitionScore,  weight: "20% weight" },
                            { label: "Trust",       value: fusionComponents.userTrustScore,   weight: "10% weight" },
                          ].map(c => (
                            <div key={c.label} className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-2.5 py-2">
                              <span className="text-[10px] text-slate-500 flex-1">{c.label}</span>
                              <span className="text-xs font-bold text-slate-200 tabular-nums">
                                {Math.round(c.value * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>

                        {explain.fusedScore?.reasoning && (
                          <p className="text-[10px] text-slate-500 mt-3 p-2.5 rounded-lg bg-slate-900/50 leading-relaxed">
                            {explain.fusedScore.reasoning}
                          </p>
                        )}
                      </motion.div>
                    )}

                    {/* Factor Bars */}
                    {activeSection === "factors" && (
                      <motion.div key="factors"
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <SectionLabel>Why this decision? — weighted contributing factors</SectionLabel>
                        <FactorBars factors={factors} />

                        {explain.explanation?.reasoning && (
                          <div className="mt-4 p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Brain className="w-3 h-3 text-red-500 flex-shrink-0" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">AI Reasoning</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed">{explain.explanation.reasoning}</p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Decision Timeline */}
                    {activeSection === "timeline" && (
                      <motion.div key="timeline"
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <SectionLabel>Decision chain — how the AI classified this report</SectionLabel>
                        <DecisionTimeline steps={timelineSteps} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ─── 4. Recommendations (collapsible) ─── */}
                  {recommendations.length > 0 && (
                    <>
                      <Divider />
                      <button onClick={() => setShowRecs(r => !r)}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors w-full">
                        <CheckCircle className="w-3 h-3" />
                        {recommendations.length} Recommendation{recommendations.length > 1 ? "s" : ""}
                        {showRecs ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                      </button>
                      <AnimatePresence>
                        {showRecs && (
                          <motion.ul
                            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                            className="mt-2.5 space-y-1.5 overflow-hidden"
                          >
                            {recommendations.map((r, i) => (
                              <motion.li key={i}
                                initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-900/40 rounded-lg px-2.5 py-2"
                              >
                                <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                                {r}
                              </motion.li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </>
                  )}

                  {/* ─── 5. Audit footer ─── */}
                  {!compact && explain.explanation?.auditId && (
                    <>
                      <Divider />
                      <div className="flex items-center justify-between text-[9px] text-slate-600">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Audit: <span className="font-mono ml-1">{explain.explanation.auditId.slice(0, 24)}…</span>
                        </span>
                        <span>{explain.explanation?.modelVersion ?? "rule-based-v1"}</span>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
