/**
 * FactorBars — "Why did the AI make this decision?"
 *
 * Each factor bar shows:
 *   - Factor label (e.g. "keyword: help", "high-risk zone")
 *   - Weight bar — green if positive contribution, red if negative
 *   - Numeric weight
 *   - Stagger-animated on mount for a dynamic feel
 *
 * This is the most human-readable part of the explainability panel —
 * even non-technical users can see which factors drove the decision.
 */
import { motion } from "framer-motion";

interface Factor {
  factor:      string;
  weight:      number; // -1 to +1 float, or 0 to +1 float
  description?: string;
}

interface Props {
  factors: Factor[];
}

export function FactorBars({ factors }: Props) {
  if (!factors.length) {
    return <p className="text-xs text-slate-500 py-2">No factors recorded for this decision.</p>;
  }

  // Sort: highest weight first
  const sorted = [...factors].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  return (
    <div className="space-y-2.5">
      {sorted.map((f, i) => {
        const isNeg  = f.weight < 0;
        const pct    = Math.abs(f.weight) * 100;
        const barClr = isNeg ? "#ef4444" : "#22c55e";
        const txtClr = isNeg ? "text-red-400" : "text-green-400";
        const sign   = isNeg ? "−" : "+";

        return (
          <motion.div
            key={f.factor}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              {/* Sign badge */}
              <span className={`text-[10px] font-black w-4 text-right ${txtClr}`}>{sign}</span>
              {/* Label */}
              <span className="flex-1 text-[11px] font-semibold text-slate-300 truncate">{f.factor}</span>
              {/* Numeric weight */}
              <span className={`text-[11px] font-black tabular-nums ${txtClr}`}>
                {sign}{Math.abs(f.weight).toFixed(2)}
              </span>
            </div>
            {/* Bar track */}
            <div className="flex items-center gap-2 pl-6">
              <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: barClr }}
                  initial={{ width: "0%" }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: i * 0.06 + 0.1, duration: 0.55, ease: "easeOut" }}
                />
              </div>
            </div>
            {f.description && (
              <p className="text-[10px] text-slate-500 pl-6 mt-0.5 leading-tight">{f.description}</p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
