import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import {
  User, MapPin, Star, Zap, TrendingDown, Award,
  ChevronDown, ChevronUp, Activity,
} from "lucide-react";
import { useState } from "react";

interface RankedResponder {
  id: string;
  name: string;
  email: string;
  role: string;
  score: number;
  breakdown: {
    skillMatch: number;
    proximityScore: number;
    pastPerformance: number;
    fatiguePenalty: number;
  };
  distanceKm: number;
  skills: string[];
  reason: string;
}

interface RankingResult {
  incidentId: string;
  recommendedResponders: RankedResponder[];
  algorithm: string;
  formula: string;
  rankedAt: string;
}

function ScoreBar({ label, value, color, icon: Icon }: {
  label: string; value: number; color: string; icon: any;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-slate-500">
          <Icon className="w-3 h-3" />{label}
        </span>
        <span className={`font-bold ${color}`}>{pct}%</span>
      </div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color.replace("text-", "bg-")}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function ResponderCard({ responder, rank }: { responder: RankedResponder; rank: number }) {
  const [open, setOpen] = useState(false);
  const scorePct = Math.round(responder.score * 100);
  const scoreColor = scorePct >= 75 ? "text-green-400" : scorePct >= 50 ? "text-yellow-400" : "text-red-400";
  const medalColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.06 }}
      className="rounded-xl border border-slate-700/50 bg-slate-900/70 overflow-hidden"
    >
      <div className="flex items-center gap-3 p-3">
        {/* Rank */}
        <div className="w-8 text-center shrink-0">
          {rank <= 2 ? (
            <Award className={`w-5 h-5 mx-auto ${medalColors[rank] ?? "text-slate-400"}`} />
          ) : (
            <span className="text-sm font-bold text-slate-500">#{rank + 1}</span>
          )}
        </div>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-slate-300">
            {responder.name?.charAt(0)?.toUpperCase() ?? "R"}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">{responder.name}</span>
            <Badge variant="outline" className="text-xs border-slate-600 text-slate-400 capitalize">
              {responder.role}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />{responder.distanceKm} km
            </span>
            {responder.reason && (
              <span className="text-slate-600 truncate">· {responder.reason}</span>
            )}
          </div>
        </div>

        {/* Score */}
        <div className="text-right shrink-0">
          <div className={`text-lg font-black ${scoreColor}`}>{(responder.score).toFixed(2)}</div>
          <div className="text-xs text-slate-500">score</div>
        </div>

        <button
          onClick={() => setOpen(o => !o)}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-500 shrink-0"
        >
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/10"
          >
            <div className="p-3 space-y-3">
              {/* Score breakdown */}
              <div className="space-y-1.5">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Score Breakdown</p>
                <ScoreBar label="Skill Match (35%)"      value={responder.breakdown.skillMatch}      color="text-blue-400"   icon={Star}         />
                <ScoreBar label="Proximity (25%)"        value={responder.breakdown.proximityScore}  color="text-green-400"  icon={MapPin}       />
                <ScoreBar label="Performance (20%)"      value={responder.breakdown.pastPerformance} color="text-purple-400" icon={TrendingDown} />
                <ScoreBar label="Fatigue penalty (−20%)" value={responder.breakdown.fatiguePenalty}  color="text-red-400"    icon={Activity}     />
              </div>
              {/* Matched skills */}
              {responder.skills.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Matched Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {responder.skills.map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-blue-950/50 border border-blue-600/30 text-blue-300">
                        {s.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-600">{responder.email}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface Props {
  reportId: string;
  emergencyType?: string;
  compact?: boolean;
}

export function ResponderRankingPanel({ reportId, compact }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["responders-ranked", reportId],
    queryFn: () => apiRequest(`/api/responders/ranked/${reportId}?limit=5`),
    enabled: !!reportId,
    refetchInterval: 60_000,
  });

  const result: RankingResult | null = data ?? null;
  const responders = result?.recommendedResponders ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Ranked Responders</h3>
        </div>
        <span className="text-xs text-slate-500">{responders.length} matched</span>
      </div>

      {!compact && result && (
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 p-2.5">
          <p className="text-xs text-slate-500 mb-0.5">{result.algorithm}</p>
          <p className="text-xs font-mono text-slate-400">{result.formula}</p>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-slate-800/40 border border-slate-700/30 animate-pulse" />
        ))
      ) : responders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-center">
          <User className="w-8 h-8 text-slate-700 mb-2" />
          <p className="text-sm text-slate-500">No responders available</p>
        </div>
      ) : (
        <AnimatePresence>
          {responders.map((r, i) => (
            <ResponderCard key={r.id} responder={r} rank={i} />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
