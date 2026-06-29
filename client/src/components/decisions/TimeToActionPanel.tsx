import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MOTION } from "@/lib/motion";
import { Zap, Clock, CheckCircle2, AlertTriangle, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricRow {
  id: string;
  incidentId: string;
  detectedAt: string;
  decisionAt: string | null;
  dispatchedAt: string | null;
  resolvedAt: string | null;
  derived: {
    detectionToDecision: number | null;
    decisionToDispatch: number | null;
    totalResponse: number | null;
    slaStatus: "met" | "warning" | "breached" | "unknown";
    slaTarget: number;
  };
}

const SLA_COLOR = {
  met: "text-green-400",
  warning: "text-yellow-400",
  breached: "text-red-400",
  unknown: "text-slate-500",
};

const SLA_BG = {
  met: "bg-green-500",
  warning: "bg-yellow-500",
  breached: "bg-red-500",
  unknown: "bg-slate-600",
};

function Seconds({ val }: { val: number | null }) {
  if (val === null) return <span className="text-slate-500">—</span>;
  return (
    <span className={cn("tabular-nums font-bold", val > 60 ? "text-red-400" : val > 30 ? "text-yellow-400" : "text-green-400")}>
      {val}s
    </span>
  );
}

function StepDot({ done }: { done: boolean }) {
  return (
    <div className={cn("w-2.5 h-2.5 rounded-full ring-2 ring-offset-2 ring-offset-slate-900",
      done ? "bg-green-500 ring-green-500/40" : "bg-slate-700 ring-slate-700/40"
    )} />
  );
}

function MetricCard({ row }: { row: MetricRow }) {
  const { derived } = row;
  const sla = derived.slaTarget;
  const total = derived.totalResponse;
  const pct = total !== null ? Math.min((total / sla) * 100, 100) : 0;

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 truncate font-mono">
          {row.incidentId.slice(0, 8)}…
        </span>
        <span className={cn("text-xs font-bold", SLA_COLOR[derived.slaStatus])}>
          {derived.slaStatus === "met" ? "✓ SLA met" :
           derived.slaStatus === "warning" ? "⚠ Near limit" :
           derived.slaStatus === "breached" ? "✗ SLA breach" : "In progress"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <StepDot done={!!row.detectedAt} />
        <div className="flex-1 h-px bg-slate-700" />
        <StepDot done={!!row.decisionAt} />
        <div className="flex-1 h-px bg-slate-700" />
        <StepDot done={!!row.dispatchedAt} />
        <div className="flex-1 h-px bg-slate-700" />
        <StepDot done={!!row.resolvedAt} />
      </div>

      <div className="grid grid-cols-3 gap-1 text-center text-xs text-slate-500">
        <span>Detected</span>
        <span>Decision</span>
        <span>Dispatched</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900 rounded-lg p-2">
          <p className="text-slate-500 mb-0.5">Detect → Decision</p>
          <Seconds val={derived.detectionToDecision} />
        </div>
        <div className="bg-slate-900 rounded-lg p-2">
          <p className="text-slate-500 mb-0.5">Decision → Dispatch</p>
          <Seconds val={derived.decisionToDispatch} />
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500">Total vs {sla}s SLA target</span>
          {total !== null && <Seconds val={total} />}
        </div>
        <div className="h-2 rounded-full bg-slate-700">
          <motion.div
            className={cn("h-full rounded-full", SLA_BG[derived.slaStatus])}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}

export function TimeToActionPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/decisions/metrics"],
    refetchInterval: 20_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/decisions/stats"],
    refetchInterval: 30_000,
  });

  const metrics: MetricRow[] = (data as any)?.metrics ?? [];

  const summaryStats = [
    { label: "Total Decisions", value: (stats as any)?.total ?? 0, icon: Zap, color: "text-blue-400" },
    { label: "Auto-Executed", value: (stats as any)?.autoExecuted ?? 0, icon: CheckCircle2, color: "text-green-400" },
    { label: "Pending Review", value: (stats as any)?.pending ?? 0, icon: AlertTriangle, color: "text-yellow-400" },
    { label: "Avg Confidence", value: `${(stats as any)?.avgConfidence ?? 0}%`, icon: TrendingDown, color: "text-purple-400" },
  ];

  return (
    <div className="space-y-4">
      <motion.div
        className="grid grid-cols-2 gap-2"
        variants={MOTION.staggerContainer}
        initial="hidden"
        animate="show"
      >
        {summaryStats.map((s) => (
          <motion.div
            key={s.label}
            variants={MOTION.staggerChild}
            className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3"
          >
            <div className="p-1.5 rounded-lg bg-slate-700">
              <s.icon className={cn("w-4 h-4", s.color)} />
            </div>
            <div>
              <motion.p
                className={cn("text-xl font-black tabular-nums", s.color)}
                key={String(s.value)}
                {...MOTION.springPop}
              >
                {s.value}
              </motion.p>
              <p className="text-xs text-slate-500 leading-none mt-0.5">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-300">Response Efficiency</h3>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-slate-800/40 animate-pulse" />
            ))}
          </div>
        ) : metrics.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No metrics yet — will populate as incidents are processed</p>
          </div>
        ) : (
          <motion.div
            className="space-y-3"
            variants={MOTION.staggerContainer}
            initial="hidden"
            animate="show"
          >
            {metrics.slice(0, 5).map((row) => (
              <motion.div key={row.id} variants={MOTION.staggerChild}>
                <MetricCard row={row} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
