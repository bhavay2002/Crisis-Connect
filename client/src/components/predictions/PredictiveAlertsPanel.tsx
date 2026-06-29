import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { MOTION } from "@/lib/motion";
import { SeverityBadge } from "@/components/ds/SeverityBadge";
import { LiveIndicator } from "@/components/ds/LiveIndicator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity, AlertTriangle, ChevronDown, ChevronUp,
  Clock, MapPin, RefreshCw, Zap, TrendingUp, Shield,
} from "lucide-react";

interface LivePrediction {
  id: string;
  location: string;
  disasterType: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  probability: number;
  timeWindow: string;
  recommendedActions: string[];
  confidence: number;
  factors: string[];
  createdAt: string;
  validUntil: string;
}

const RISK_CONFIG = {
  VERY_HIGH: { color: "text-red-400",   bg: "bg-red-950/60",  border: "border-red-600/50", bar: "bg-red-500",    pulse: true  },
  HIGH:      { color: "text-orange-400", bg: "bg-orange-950/60", border: "border-orange-500/40", bar: "bg-orange-500", pulse: true  },
  MEDIUM:    { color: "text-yellow-400", bg: "bg-yellow-950/40", border: "border-yellow-600/30", bar: "bg-yellow-500", pulse: false },
  LOW:       { color: "text-green-400",  bg: "bg-green-950/30", border: "border-green-700/30", bar: "bg-green-500",  pulse: false },
};

const DISASTER_ICONS: Record<string, string> = {
  flood: "🌊", earthquake: "🌍", fire: "🔥", storm: "🌪️",
  epidemic: "🦠", road_accident: "🚗", building_collapse: "🏗️",
  power_outage: "⚡", water_contamination: "💧", gas_leak: "⚠️",
  chemical_spill: "☣️", mass_accident: "🚑",
};

function PredictionCard({ pred, isAdmin }: { pred: LivePrediction; isAdmin?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = RISK_CONFIG[pred.riskLevel] ?? RISK_CONFIG.LOW;
  const icon = DISASTER_ICONS[pred.disasterType] ?? "⚠️";
  const pct = Math.round(pred.probability * 100);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}
    >
      {cfg.pulse && (
        <div className="h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse" />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`text-2xl shrink-0 ${cfg.pulse ? "animate-pulse" : ""}`}>{icon}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-bold uppercase tracking-wide ${cfg.color}`}>
                  {pred.riskLevel.replace("_", " ")} RISK
                </span>
                <Badge variant="outline" className="text-xs border-white/20 text-slate-300">
                  {pred.disasterType.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="text-sm text-slate-200 truncate">{pred.location}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Probability bar */}
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Probability
            </span>
            <span className={`font-bold ${cfg.color}`}>{pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${cfg.bar} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span className="text-slate-200">{pred.timeWindow}</span>
          </span>
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            <span>{pred.confidence}% conf.</span>
          </span>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-white/10"
          >
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Recommended Actions</p>
                <ul className="space-y-1.5">
                  {pred.recommendedActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-xs text-slate-500 mt-0.5 font-mono">{i + 1}.</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Signal Sources</p>
                <div className="flex flex-wrap gap-1.5">
                  {pred.factors.map((f, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-xs text-slate-300">
                      {f.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-xs text-slate-500">
                Valid until: {new Date(pred.validUntil).toLocaleTimeString()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface Props {
  isAdmin?: boolean;
  compact?: boolean;
}

export function PredictiveAlertsPanel({ isAdmin, compact }: Props) {
  const qc = useQueryClient();

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["predictions-live"],
    queryFn: () => apiRequest("/api/predictions/live"),
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["predictions-stats"],
    queryFn: () => apiRequest("/api/predictions/stats"),
    refetchInterval: 60_000,
  });

  const generate = useMutation({
    mutationFn: () => apiRequest("/api/predictions/generate-all", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["predictions-live"] });
      qc.invalidateQueries({ queryKey: ["predictions-stats"] });
    },
  });

  const predictions: LivePrediction[] = data?.predictions ?? [];
  const highRisk = predictions.filter(p => p.riskLevel === "HIGH" || p.riskLevel === "VERY_HIGH");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-purple-900/40 border border-purple-500/30">
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Predictive Alerts</h3>
              <LiveIndicator size="sm" />
            </div>
            <p className="text-xs text-slate-400">
              {predictions.length} active zones · {highRisk.length} high risk
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-purple-500/40 text-purple-300 hover:bg-purple-900/30"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              {generate.isPending
                ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Running…</>
                : <><Zap className="w-3 h-3 mr-1" /> Generate</>
              }
            </Button>
          )}
        </div>
      </div>

      {/* Stats row */}
      {stats && !compact && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Active", value: stats.total ?? 0, icon: Activity, color: "text-blue-400" },
            { label: "High Risk", value: stats.high ?? 0, icon: AlertTriangle, color: "text-red-400" },
            { label: "Avg Conf.", value: `${stats.avgConfidence ?? 0}%`, icon: Shield, color: "text-green-400" },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-2.5 text-center">
              <s.icon className={`w-3.5 h-3.5 ${s.color} mx-auto mb-1`} />
              <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Predictions list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-xl bg-slate-800/40 border border-slate-700/30 animate-pulse" />
            ))}
          </div>
        ) : predictions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Shield className="w-10 h-10 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">No active predictions</p>
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-3 text-purple-400"
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
              >
                <Zap className="w-3 h-3 mr-1" /> Generate predictions
              </Button>
            )}
          </div>
        ) : (
          <AnimatePresence>
            {predictions.map(p => (
              <PredictionCard key={p.id} pred={p} isAdmin={isAdmin} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {dataUpdatedAt > 0 && (
        <p className="text-xs text-slate-600 mt-3 text-right">
          Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
