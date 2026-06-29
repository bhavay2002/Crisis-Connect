import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useDecisionStore } from "@/store/decisionStore";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeMessage } from "@/providers/WebSocketProvider";
import { CriticalBadge } from "./CriticalBadge";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, X, MapPin, Radio, Eye, ShieldAlert,
  ChevronRight, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const DECISION_ROLES = ["volunteer", "ngo", "admin", "government", "authority", "super_admin"];

interface Decision {
  incidentId: string;
  title: string;
  type: string;
  severity: number;
  priority: "CRITICAL" | "HIGH";
  location: string;
  status: string;
  createdAt: string;
  recommendedActions: Array<{
    id: string;
    label: string;
    type: "primary" | "secondary" | "danger";
    confidence: number;
    url: string;
  }>;
}

function ActionIcon({ id }: { id: string }) {
  if (id === "dispatch") return <Zap className="w-3.5 h-3.5" />;
  if (id === "broadcast") return <Radio className="w-3.5 h-3.5" />;
  if (id === "view") return <Eye className="w-3.5 h-3.5" />;
  if (id === "override") return <ShieldAlert className="w-3.5 h-3.5" />;
  return <ChevronRight className="w-3.5 h-3.5" />;
}

export function ActionPanel() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { activeDecision, setDecision, clearDecision } = useDecisionStore();
  const dismissedRef = useRef<Set<string>>(new Set());

  const role = user?.role ?? "citizen";
  const canSee = DECISION_ROLES.includes(role);

  const { data } = useQuery<{ decisions: Decision[]; count: number }>({
    queryKey: ["/api/decisions/active"],
    enabled: canSee,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  useRealtimeMessage((msg) => {
    if (["new_report", "report_updated", "sos_alert"].includes(msg.type)) {
      queryClient.invalidateQueries({ queryKey: ["/api/decisions/active"] });
    }
  });

  useEffect(() => {
    if (!data?.decisions?.length) return;
    const top = data.decisions[0];
    if (!top) return;
    if (dismissedRef.current.has(top.incidentId)) return;
    if (activeDecision?.incidentId === top.incidentId) return;
    setDecision(top);
  }, [data, setDecision, activeDecision]);

  const handleDismiss = () => {
    if (activeDecision) dismissedRef.current.add(activeDecision.incidentId);
    clearDecision();
  };

  if (!canSee) return null;

  return (
    <AnimatePresence>
      {activeDecision && (
        <motion.div
          key={activeDecision.incidentId}
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
          className={cn(
            "fixed bottom-6 right-6 z-50 w-80 rounded-2xl shadow-2xl border overflow-hidden",
            activeDecision.priority === "CRITICAL"
              ? "border-red-500/40 bg-slate-900"
              : "border-orange-500/40 bg-slate-900"
          )}
        >
          {/* Top accent bar */}
          <div className={cn(
            "h-1 w-full",
            activeDecision.priority === "CRITICAL" ? "bg-red-600" : "bg-orange-500"
          )} />

          <div className="p-4">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
                  activeDecision.priority === "CRITICAL" ? "bg-red-500/15" : "bg-orange-500/15"
                )}>
                  <AlertTriangle className={cn(
                    "w-4 h-4",
                    activeDecision.priority === "CRITICAL" ? "text-red-500" : "text-orange-500"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <CriticalBadge
                      severity={activeDecision.priority === "CRITICAL" ? "critical" : "high"}
                      pulse={activeDecision.priority === "CRITICAL"}
                    />
                  </div>
                  <p className="text-xs font-bold text-white leading-tight line-clamp-2">
                    {activeDecision.title}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 mt-0.5"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Location + confidence */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{activeDecision.location}</span>
              </div>
              <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full flex-shrink-0">
                AI: {Math.round(activeDecision.severity * 100)}%
              </span>
            </div>

            {/* Recommended actions */}
            <div className="space-y-1.5">
              {activeDecision.recommendedActions.slice(0, 3).map((action) => (
                <Link key={action.id} href={action.url}>
                  <button
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all",
                      action.type === "primary"
                        ? "bg-red-600 hover:bg-red-500 text-white"
                        : action.type === "danger"
                          ? "bg-slate-700 hover:bg-slate-600 text-orange-400 border border-orange-500/30"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                    )}
                    onClick={handleDismiss}
                  >
                    <span className="flex items-center gap-1.5">
                      <ActionIcon id={action.id} />
                      {action.label}
                    </span>
                    <span className="opacity-60">{Math.round(action.confidence * 100)}%</span>
                  </button>
                </Link>
              ))}
            </div>

            {/* Footer */}
            <p className="text-[10px] text-slate-600 mt-2.5 text-center">
              AI decision engine • confidence weighted
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
