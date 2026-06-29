/**
 * DecisionTimeline — how the AI decision evolved step by step.
 *
 * Shows the reasoning chain as a vertical stepper. Each step reveals
 * one decision the AI made, with its timestamp derived from the analysis.
 *
 * This pattern is used in:
 *   - Trading systems (order lifecycle)
 *   - Fraud detection (investigation trace)
 *   - Security monitoring (event chain)
 *
 * The data is DERIVED from the explain response — we synthesize a
 * human-readable chain from the raw AI output, rather than requiring
 * a separate timeline API.
 */
import { motion } from "framer-motion";

export interface TimelineStep {
  id:       string;
  time:     string;
  event:    string;
  detail?:  string;
  type:     "info" | "warning" | "critical" | "success" | "upgrade";
}

const TYPE_STYLE: Record<TimelineStep["type"], { dot: string; text: string; line: string }> = {
  info:     { dot: "bg-slate-500",     text: "text-slate-300",  line: "border-slate-700"   },
  warning:  { dot: "bg-yellow-500",    text: "text-yellow-300", line: "border-yellow-900"  },
  critical: { dot: "bg-red-500 animate-pulse", text: "text-red-300",    line: "border-red-900"     },
  success:  { dot: "bg-green-500",     text: "text-green-300",  line: "border-green-900"   },
  upgrade:  { dot: "bg-orange-500",    text: "text-orange-300", line: "border-orange-900"  },
};

interface Props {
  steps: TimelineStep[];
}

export function DecisionTimeline({ steps }: Props) {
  if (!steps.length) {
    return <p className="text-xs text-slate-500 py-2">No timeline data available.</p>;
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-3 bottom-3 w-px bg-slate-700" />

      <div className="space-y-3">
        {steps.map((step, i) => {
          const style = TYPE_STYLE[step.type] || TYPE_STYLE.info;
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className="flex gap-3 relative"
            >
              {/* Dot */}
              <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5 z-10 ${style.dot}`} />
              {/* Content */}
              <div className="flex-1 min-w-0 pb-0.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className={`text-[11px] font-bold ${style.text}`}>{step.event}</span>
                  <span className="text-[10px] text-slate-600 tabular-nums">{step.time}</span>
                </div>
                {step.detail && (
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{step.detail}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * deriveTimeline — synthesize a decision timeline from the raw explain response.
 * Constructs a human-readable reasoning chain from the structured AI output.
 */
export function deriveTimeline(explain: any, reportCreatedAt: string): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const base = new Date(reportCreatedAt);

  const fmt = (offsetMs: number) => {
    const d = new Date(base.getTime() + offsetMs);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  steps.push({
    id: "received",
    time: fmt(0),
    event: "Report received by system",
    type: "info",
  });

  // Urgency classification
  const urgencyLevel = explain.urgency?.level ?? "unknown";
  const urgencyScore = explain.urgency?.score ?? 0;
  steps.push({
    id: "urgency",
    time: fmt(800),
    event: `AI urgency classified: ${urgencyLevel.toUpperCase()}`,
    detail: `Urgency score ${urgencyScore.toFixed(1)}/10`,
    type: urgencyScore >= 7 ? "warning" : "info",
  });

  // Urgency factors
  const factors: string[] = explain.urgency?.factors ?? [];
  if (factors.length) {
    steps.push({
      id: "factors",
      time: fmt(1200),
      event: `${factors.length} urgency signal${factors.length > 1 ? "s" : ""} detected`,
      detail: factors.slice(0, 2).join("; "),
      type: "info",
    });
  }

  // Location risk
  const locationRisk = explain.fusedScore?.components?.locationRisk ?? 0;
  if (locationRisk >= 0.5) {
    steps.push({
      id: "location",
      time: fmt(1600),
      event: `High-risk location confirmed (${Math.round(locationRisk * 100)}%)`,
      type: locationRisk >= 0.8 ? "warning" : "info",
    });
  }

  // Repetition detection
  const repetition = explain.fusedScore?.components?.repetitionScore ?? 0;
  if (repetition >= 0.4) {
    steps.push({
      id: "repetition",
      time: fmt(2000),
      event: `Similar reports detected in cluster`,
      detail: `Repetition factor: ${Math.round(repetition * 100)}%`,
      type: repetition >= 0.7 ? "upgrade" : "info",
    });
  }

  // Fake detection
  if (explain.fakeDetection?.isSuspicious) {
    steps.push({
      id: "fake",
      time: fmt(2400),
      event: "Suspicious activity flagged",
      detail: (explain.fakeDetection?.reasons ?? []).join(", ") || "Fraud signals detected",
      type: "critical",
    });
  }

  // Intent analysis
  if (explain.intent?.isGenuineEmergency === false) {
    steps.push({
      id: "intent",
      time: fmt(2600),
      event: "Report intent: not classified as genuine emergency",
      type: "warning",
    });
  } else if (explain.intent?.isGenuineEmergency) {
    steps.push({
      id: "intent",
      time: fmt(2600),
      event: "Report intent verified: genuine emergency",
      type: "success",
    });
  }

  // Final decision
  const priority = explain.fusedScore?.priority ?? "UNKNOWN";
  const finalScore = explain.fusedScore?.finalScore ?? 0;
  steps.push({
    id: "final",
    time: fmt(3200),
    event: `Final classification: ${priority}`,
    detail: `Fused score ${Math.round(finalScore * 100)}% · ${explain.explanation?.triggered ? "Alert triggered" : "No alert triggered"}`,
    type: priority === "CRITICAL" ? "critical" : priority === "HIGH" ? "upgrade" : priority === "LOW" ? "success" : "info",
  });

  return steps;
}
