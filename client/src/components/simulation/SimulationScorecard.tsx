import { motion } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Clock, Zap, Activity, Target } from "lucide-react";

interface SimMetrics {
  totalEventsInjected: number;
  reportsCreated: number;
  sosAlertsCreated: number;
  peakSeverity: string;
  estimatedAffected: number;
  responseTimeSimMs: number;
  queueBacklog: number;
  failureRate: number;
  scenarioScore: number;
  dispatchEfficiency?: number;
  systemLoad?: number;
  failures?: number;
  responseScore?: number;
  slaCompliance?: number;
  missedCritical?: number;
}

interface Props {
  metrics: SimMetrics;
  scenario: string;
  location: string;
  intensity: string;
}

function GaugeBar({ value, max = 1, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
      <motion.div
        className={`h-full ${color} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
      />
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-400" : score >= 60 ? "text-yellow-400" : "text-red-400";
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Poor";
  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
        className={`text-5xl font-black ${color}`}
      >
        {score}
      </motion.div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
      <div className="text-xs text-slate-500">Response Score</div>
    </div>
  );
}

export function SimulationScorecard({ metrics, scenario, location, intensity }: Props) {
  const responseScore = metrics.responseScore ?? metrics.scenarioScore ?? 0;
  const dispatchEff = metrics.dispatchEfficiency ?? 0;
  const systemLoad = metrics.systemLoad ?? 0;
  const failures = metrics.failures ?? 0;
  const slaCompliance = metrics.slaCompliance ?? 0;
  const missedCritical = metrics.missedCritical ?? 0;
  const responseMs = metrics.responseTimeSimMs ?? 0;

  const scoreColor = responseScore >= 80 ? "border-green-500/40" : responseScore >= 60 ? "border-yellow-500/40" : "border-red-500/40";

  return (
    <div className={`rounded-xl border ${scoreColor} bg-slate-900/80 overflow-hidden`}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Simulation Scorecard</h3>
          <p className="text-xs text-slate-400 capitalize">
            {scenario.replace(/_/g, " ")} · {location} · {intensity}
          </p>
        </div>
        <ScoreRing score={responseScore} />
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        {/* Response Time */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-400"><Clock className="w-3 h-3" /> Response Time</span>
            <span className="text-white font-mono">{responseMs < 1000 ? `${responseMs}ms` : `${(responseMs / 1000).toFixed(1)}s`}</span>
          </div>
          <GaugeBar
            value={Math.max(0, 1 - responseMs / 10000)}
            color="bg-blue-500"
          />
        </div>

        {/* Dispatch Efficiency */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-400"><Zap className="w-3 h-3" /> Dispatch Eff.</span>
            <span className={`font-bold ${dispatchEff >= 0.75 ? "text-green-400" : dispatchEff >= 0.5 ? "text-yellow-400" : "text-red-400"}`}>
              {Math.round(dispatchEff * 100)}%
            </span>
          </div>
          <GaugeBar
            value={dispatchEff}
            color={dispatchEff >= 0.75 ? "bg-green-500" : dispatchEff >= 0.5 ? "bg-yellow-500" : "bg-red-500"}
          />
        </div>

        {/* System Load */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-400"><Activity className="w-3 h-3" /> System Load</span>
            <span className={`font-bold ${systemLoad < 0.6 ? "text-green-400" : systemLoad < 0.85 ? "text-yellow-400" : "text-red-400"}`}>
              {Math.round(systemLoad * 100)}%
            </span>
          </div>
          <GaugeBar
            value={systemLoad}
            color={systemLoad < 0.6 ? "bg-green-500" : systemLoad < 0.85 ? "bg-yellow-500" : "bg-red-500"}
          />
        </div>

        {/* SLA Compliance */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-400"><Target className="w-3 h-3" /> SLA Compliance</span>
            <span className={`font-bold ${slaCompliance >= 0.9 ? "text-green-400" : slaCompliance >= 0.7 ? "text-yellow-400" : "text-red-400"}`}>
              {Math.round(slaCompliance * 100)}%
            </span>
          </div>
          <GaugeBar
            value={slaCompliance}
            color={slaCompliance >= 0.9 ? "bg-green-500" : slaCompliance >= 0.7 ? "bg-yellow-500" : "bg-red-500"}
          />
        </div>
      </div>

      {/* Bottom summary row */}
      <div className="px-4 pb-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-800/60 p-2.5 text-center">
          <div className={`text-lg font-bold ${failures === 0 ? "text-green-400" : failures < 3 ? "text-yellow-400" : "text-red-400"}`}>
            {failures}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <XCircle className="w-3 h-3" /> Failures
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/60 p-2.5 text-center">
          <div className={`text-lg font-bold ${missedCritical === 0 ? "text-green-400" : "text-red-400"}`}>
            {missedCritical}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Missed
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/60 p-2.5 text-center">
          <div className="text-lg font-bold text-blue-400">{metrics.reportsCreated}</div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <CheckCircle className="w-3 h-3" /> Injected
          </div>
        </div>
      </div>
    </div>
  );
}
