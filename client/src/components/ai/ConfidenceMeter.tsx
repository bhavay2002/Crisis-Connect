/**
 * ConfidenceMeter — animated gradient confidence bar.
 *
 * Not just a number. Shows the confidence level as a filled bar with:
 *   - Animated fill on mount
 *   - Color coded by level (green / yellow / orange / red)
 *   - Human label (HIGH / MEDIUM / LOW / UNCERTAIN)
 *
 * Used in fintech dashboards for risk scoring — same principle here.
 */
import { motion } from "framer-motion";

interface Props {
  value: number; // 0–1 float
  animate?: boolean;
}

function getConfig(pct: number) {
  if (pct >= 80) return { label: "HIGH CONFIDENCE", color: "#22c55e", track: "rgba(34,197,94,0.15)",  text: "text-green-400"  };
  if (pct >= 60) return { label: "MODERATE",         color: "#eab308", track: "rgba(234,179,8,0.15)",  text: "text-yellow-400" };
  if (pct >= 40) return { label: "LOW CONFIDENCE",   color: "#f97316", track: "rgba(249,115,22,0.15)", text: "text-orange-400" };
  return              { label: "UNCERTAIN",           color: "#ef4444", track: "rgba(239,68,68,0.15)",  text: "text-red-400"    };
}

export function ConfidenceMeter({ value, animate = true }: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const { label, color, track, text } = getConfig(pct);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-black uppercase tracking-widest ${text}`}>{label}</span>
        <span className={`text-xl font-black tabular-nums ${text}`}>{pct}%</span>
      </div>
      {/* Track */}
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: track }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
          initial={animate ? { width: "0%" } : { width: `${pct}%` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
        />
      </div>
      {/* Ticks */}
      <div className="flex justify-between text-[9px] text-slate-600 px-0.5 select-none">
        <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
      </div>
    </div>
  );
}
