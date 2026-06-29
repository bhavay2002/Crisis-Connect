import { motion, AnimatePresence } from "framer-motion";
import { useDecisionStore, selectEventLog, type TimelineEvent } from "@/store/decisionStore";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { AlertTriangle, Radio, Bell, Activity, Zap, RefreshCw } from "lucide-react";

function relativeTime(timestamp: number) {
  const diff = (Date.now() - timestamp) / 1000;
  if (diff < 10) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const TYPE_CONFIG: Record<TimelineEvent["type"], { icon: React.ElementType; color: string; dot: string }> = {
  new_report:     { icon: AlertTriangle, color: "text-red-500",    dot: "bg-red-500" },
  report_updated: { icon: RefreshCw,     color: "text-blue-500",   dot: "bg-blue-400" },
  sos_alert:      { icon: Zap,           color: "text-orange-500", dot: "bg-orange-500" },
  broadcast:      { icon: Radio,         color: "text-purple-500", dot: "bg-purple-500" },
  notification:   { icon: Bell,          color: "text-sky-500",    dot: "bg-sky-400" },
  system:         { icon: Activity,      color: "text-slate-400",  dot: "bg-slate-500" },
};

interface IncidentTimelineProps {
  className?: string;
}

export function IncidentTimeline({ className }: IncidentTimelineProps) {
  const events = useDecisionStore(selectEventLog);

  return (
    <div className={cn("rounded-xl border bg-background p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-bold text-sm">Live Event Feed</h3>
        <div className="ml-auto flex items-center gap-1 text-xs text-green-600">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <Activity className="w-6 h-6 text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">Waiting for events…</p>
        </div>
      ) : (
        <div className="space-y-0">
          <AnimatePresence initial={false}>
            {events.slice(0, 12).map((event) => {
              const cfg = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.system;
              const Icon = cfg.icon;

              const content = (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="flex gap-3 group py-1.5"
                >
                  <div className="flex flex-col items-center">
                    <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", cfg.dot)} />
                    <div className="w-px flex-1 bg-border mt-1" />
                  </div>
                  <div className="pb-1 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <Icon className={cn("w-3 h-3 flex-shrink-0", cfg.color)} />
                        <p className="text-xs font-medium leading-snug truncate">{event.message}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {relativeTime(event.timestamp)}
                      </span>
                    </div>
                    {event.subtext && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate pl-4">{event.subtext}</p>
                    )}
                  </div>
                </motion.div>
              );

              return event.url ? (
                <Link key={event.id} href={event.url} className="block hover:opacity-80 transition-opacity cursor-pointer">
                  {content}
                </Link>
              ) : (
                <div key={event.id}>{content}</div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
