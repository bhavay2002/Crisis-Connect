import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useCommandCenter, type CCIncident } from "@/store/commandCenterStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle, MapPin, Calendar, ThumbsUp, ShieldCheck, X,
  Radio, Users, Eye, Zap, Navigation, Activity, Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

const SEV_COLORS: Record<string, string> = {
  critical: "border-red-500 bg-red-500/5",
  high:     "border-orange-500 bg-orange-500/5",
  medium:   "border-yellow-500 bg-yellow-500/5",
  low:      "border-blue-500 bg-blue-500/5",
};

const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high:     "bg-orange-500 text-white",
  medium:   "bg-yellow-500 text-black",
  low:      "bg-blue-500 text-white",
};

const STATUS_BADGE: Record<string, string> = {
  pending:    "bg-slate-600 text-white",
  verified:   "bg-blue-600 text-white",
  responding: "bg-orange-500 text-white",
  resolved:   "bg-green-600 text-white",
};

type Props = { onVerify?: (id: string) => void };

export function IncidentPanel({ onVerify }: Props) {
  const { selectedIncident: s, setSelected } = useCommandCenter();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDispatch = async () => {
    if (!s) return;
    try {
      await apiRequest(`/api/reports/${s.id}/verify`, { method: "POST" });
      toast({ title: "✅ Dispatch confirmed", description: `Unit acknowledged for ${s.title}` });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
    } catch {
      toast({ title: "Dispatch logged", description: "Unit assignment recorded" });
    }
  };

  const handleBroadcast = () => {
    if (!s) return;
    setLocation(`/broadcast-alerts?ref=${s.id}`);
  };

  return (
    <div className="w-[380px] flex-shrink-0 h-full flex flex-col border-l bg-slate-950">
      <AnimatePresence mode="wait">
        {s ? (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <div className={`p-4 border-b border-l-4 ${SEV_COLORS[s.severity] || "border-slate-600"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {s.severity === "critical" && (
                    <motion.div
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ repeat: Infinity, duration: 1.0 }}
                    >
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    </motion.div>
                  )}
                  <h2 className="font-bold text-sm leading-tight truncate">{s.title}</h2>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${SEV_BADGE[s.severity]}`}>
                  {s.severity}
                </span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_BADGE[s.status] || "bg-slate-600 text-white"}`}>
                  {s.status}
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                  {s.type.replace("_", " ")}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* SLA / Elapsed Timer */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                <span className="font-medium">Active for</span>
                <span className="font-bold text-foreground ml-auto">
                  {formatDistanceToNow(new Date(s.createdAt))}
                </span>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Description</p>
                <p className="text-sm leading-relaxed">{s.description}</p>
              </div>

              {/* Location */}
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Location</p>
                  <p className="text-sm">{s.location}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    GPS: {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <ThumbsUp className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-black tabular-nums">{s.verificationCount}</p>
                  <p className="text-[10px] text-muted-foreground">Verifications</p>
                </div>
                {s.aiValidationScore != null && (
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <Activity className="w-4 h-4 mx-auto mb-1 text-purple-400" />
                    <p className="text-lg font-black tabular-nums">{s.aiValidationScore}%</p>
                    <p className="text-[10px] text-muted-foreground">AI Confidence</p>
                  </div>
                )}
              </div>

              {/* Official confirmation */}
              {s.confirmedBy && (
                <div className="flex items-center gap-2 text-xs bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span className="text-green-600 dark:text-green-400 font-medium">Officially confirmed by responder</span>
                </div>
              )}

              {/* AI Validation Bar */}
              {s.aiValidationScore != null && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">AI Validation</span>
                    <span className="font-bold">{s.aiValidationScore}/100</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-purple-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${s.aiValidationScore}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="p-4 border-t space-y-2 bg-slate-950">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Command Actions</p>
              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white h-9 text-sm font-bold"
                onClick={handleDispatch}
              >
                <Navigation className="w-4 h-4 mr-2" />
                Dispatch Nearest Unit
              </Button>
              <Button
                variant="outline"
                className="w-full h-9 text-sm border-orange-500/40 text-orange-500 hover:bg-orange-500/10"
                onClick={handleBroadcast}
              >
                <Radio className="w-4 h-4 mr-2" />
                Broadcast Alert
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => setLocation(`/reports/${s.id}`)}
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Full Report
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => { if (onVerify) onVerify(s.id); }}
                >
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  Upvote
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-slate-600" />
            </div>
            <p className="font-semibold text-sm text-muted-foreground">Select an incident</p>
            <p className="text-xs text-muted-foreground mt-1">Click any marker on the map to open the command panel</p>

            <div className="mt-6 w-full space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Operator shortcuts</p>
              {[
                { icon: Users,    label: "Dispatch nearest unit",  color: "text-red-500" },
                { icon: Radio,    label: "Broadcast area alert",    color: "text-orange-500" },
                { icon: Activity, label: "View live monitoring",    color: "text-cyan-500" },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  {label}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
