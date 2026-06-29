import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MOTION } from "@/lib/motion";
import {
  Zap, AlertTriangle, Radio, Shield, CheckCircle2, XCircle,
  Clock, ChevronRight, Bot, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Decision {
  id: string;
  incidentId: string;
  incidentTitle: string | null;
  type: "DISPATCH" | "ESCALATE" | "BROADCAST" | "PREDEPLOY";
  confidence: number;
  severity: string;
  reason: string;
  contributingSignals: { aiUrgency: number; locationRisk: number; repetition: number; trust: number };
  recommendedActions: Array<{ type: string; priority: number }>;
  autoExecutable: boolean;
  status: "PENDING" | "APPROVED" | "EXECUTED" | "REJECTED";
  createdAt: string;
}

const TYPE_CONFIG = {
  DISPATCH: { label: "DISPATCH", icon: Zap, color: "bg-red-500/10 text-red-400 border-red-500/30", dot: "bg-red-400" },
  ESCALATE: { label: "ESCALATE", icon: AlertTriangle, color: "bg-orange-500/10 text-orange-400 border-orange-500/30", dot: "bg-orange-400" },
  BROADCAST: { label: "BROADCAST", icon: Radio, color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", dot: "bg-yellow-400" },
  PREDEPLOY: { label: "PREDEPLOY", icon: Shield, color: "bg-blue-500/10 text-blue-400 border-blue-500/30", dot: "bg-blue-400" },
};

const STATUS_CONFIG = {
  PENDING: { label: "Awaiting Approval", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  APPROVED: { label: "Approved", color: "text-blue-400", bg: "bg-blue-500/10" },
  EXECUTED: { label: "Executed", color: "text-green-400", bg: "bg-green-500/10" },
  REJECTED: { label: "Rejected", color: "text-slate-400", bg: "bg-slate-500/10" },
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-green-500" : value >= 60 ? "bg-yellow-500" : "bg-orange-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-700">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-400">{value}%</span>
    </div>
  );
}

export function DecisionFeed({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/decisions/active"],
    refetchInterval: 15_000,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/decisions/${id}/approve`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decisions"] });
      toast({ title: "Decision approved", description: "Action is being executed." });
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest(`/api/decisions/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decisions"] });
      toast({ title: "Decision rejected" });
    },
  });

  const decisionList: Decision[] = (data as any)?.decisions ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-800/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (decisionList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="w-10 h-10 text-green-500/50 mb-3" />
        <p className="text-sm font-medium text-slate-300">No active decisions</p>
        <p className="text-xs text-slate-500 mt-1">AI will generate decisions when new incidents arrive</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="mt-4 text-slate-400">
          <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-3"
      variants={MOTION.staggerContainer}
      initial="hidden"
      animate="show"
    >
      <AnimatePresence mode="popLayout">
        {decisionList.map((dec) => {
          const cfg = TYPE_CONFIG[dec.type];
          const statusCfg = STATUS_CONFIG[dec.status];
          const Icon = cfg.icon;
          const isExpanded = expandedId === dec.id;

          return (
            <motion.div
              key={dec.id}
              variants={MOTION.staggerChild}
              layout
              className={cn(
                "rounded-xl border bg-slate-900 overflow-hidden cursor-pointer transition-colors",
                dec.status === "PENDING" ? "border-slate-700 hover:border-slate-600" : "border-slate-800",
                dec.type === "DISPATCH" && dec.status === "PENDING" && "border-red-500/30"
              )}
              onClick={() => setExpandedId(isExpanded ? null : dec.id)}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5 p-1.5 rounded-lg border", cfg.color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-xs font-bold tracking-widest uppercase", cfg.color.split(" ")[1])}>
                        {cfg.label}
                      </span>
                      {dec.autoExecutable && (
                        <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/30 rounded px-1.5 py-0.5 font-medium">
                          AUTO
                        </span>
                      )}
                      <span className={cn("text-xs rounded px-1.5 py-0.5 ml-auto", statusCfg.bg, statusCfg.color)}>
                        {statusCfg.label}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-200 mt-1 truncate">
                      {dec.incidentTitle || `Incident ${dec.incidentId.slice(0, 8)}`}
                    </p>

                    {!compact && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{dec.reason}</p>
                    )}

                    <div className="mt-2">
                      <ConfidenceBar value={dec.confidence} />
                    </div>
                  </div>

                  <ChevronRight
                    className={cn(
                      "w-4 h-4 text-slate-600 shrink-0 transition-transform mt-0.5",
                      isExpanded && "rotate-90"
                    )}
                  />
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-slate-800"
                  >
                    <div className="p-4 space-y-4">
                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">AI Reasoning</p>
                        <p className="text-xs text-slate-300">{dec.reason}</p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Signal Breakdown</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "AI Urgency", value: dec.contributingSignals.aiUrgency },
                            { label: "Location Risk", value: dec.contributingSignals.locationRisk },
                            { label: "Repetition", value: dec.contributingSignals.repetition },
                            { label: "Trust Score", value: dec.contributingSignals.trust },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-slate-800 rounded-lg p-2">
                              <p className="text-xs text-slate-500">{label}</p>
                              <ConfidenceBar value={value} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {dec.status === "PENDING" && (
                        <div className="flex gap-2">
                          <motion.div {...MOTION.pressable} className="flex-1">
                            <Button
                              className="w-full bg-green-600 hover:bg-green-500 text-white text-xs h-8"
                              onClick={(e) => { e.stopPropagation(); approveMut.mutate(dec.id); }}
                              disabled={approveMut.isPending}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1.5" /> Approve & Execute
                            </Button>
                          </motion.div>
                          <motion.div {...MOTION.pressable}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                rejectMut.mutate({ id: dec.id, reason: "Rejected by operator" });
                              }}
                              disabled={rejectMut.isPending}
                            >
                              <XCircle className="w-3 h-3 mr-1" /> Reject
                            </Button>
                          </motion.div>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Bot className="w-3 h-3" />
                        <span className="text-xs">Generated by CrisisConnect Decision Engine</span>
                        <span className="text-slate-700">·</span>
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">{new Date(dec.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
