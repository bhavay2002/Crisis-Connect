/**
 * NetworkStatusBanner — the global system state communicator.
 *
 * Always visible when the system is not CONNECTED.
 * Slides in from above `<main>` without shifting the layout — uses
 * Framer Motion height animation with overflow:hidden so content
 * below doesn't jump.
 *
 * State → UX mapping (informed by Slack / Linear / Figma patterns):
 *   OFFLINE    → amber "No network · offline mode"
 *   DEGRADED   → blue  "Live feed disconnected · reconnecting…"
 *   RECOVERING → green "Connection restored · syncing"
 *   CONNECTED  → hidden (zero height)
 *
 * The RECOVERING state auto-dismisses — it's shown for 3 s then gone.
 * This gives users positive feedback that the system recovered.
 */
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Radio, RefreshCw, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSystemStatus } from "@/shared/hooks/useSystemStatus";

const CONFIG = {
  OFFLINE: {
    bg:     "bg-amber-500",
    icon:   <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />,
    text:   (q: number) =>
      q > 0
        ? `No network · ${q} request${q > 1 ? "s" : ""} queued — will send automatically`
        : "No network · working in offline mode",
  },
  DEGRADED: {
    bg:     "bg-blue-600",
    icon:   <Radio className="w-3.5 h-3.5 flex-shrink-0 animate-pulse" />,
    text:   () => "Live feed disconnected · reconnecting…",
  },
  RECOVERING: {
    bg:     "bg-green-600",
    icon:   <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />,
    text:   (q: number, syncing: boolean) =>
      syncing
        ? `Connection restored · syncing ${q} queued request${q > 1 ? "s" : ""}…`
        : "Connection restored",
  },
  CONNECTED: null,
} as const;

export function NetworkStatusBanner() {
  const { state, queueLength, isSyncing } = useSystemStatus();
  const { toast } = useToast();
  const prevState = useRef(state);
  const visible   = state !== "CONNECTED";

  // Fire a toast when the system recovers — separate from the banner
  useEffect(() => {
    if (prevState.current !== "CONNECTED" && state === "CONNECTED") {
      toast({
        title: "Connection restored",
        description: "Live feed active · all systems operational",
        duration: 3000,
      });
    }
    prevState.current = state;
  }, [state, toast]);

  const cfg = CONFIG[state];

  return (
    <AnimatePresence>
      {visible && cfg && (
        <motion.div
          key={state}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="overflow-hidden flex-shrink-0"
        >
          <div className={`${cfg.bg} text-white text-xs font-semibold flex items-center justify-center gap-2 py-2 px-4`}>
            {state === "RECOVERING" && isSyncing
              ? <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
              : cfg.icon}
            <span>
              {state === "OFFLINE"
                ? CONFIG.OFFLINE.text(queueLength)
                : state === "DEGRADED"
                ? CONFIG.DEGRADED.text()
                : CONFIG.RECOVERING.text(queueLength, isSyncing)}
            </span>

            {/* Offline: animated queued dot count */}
            {state === "OFFLINE" && queueLength > 0 && (
              <span className="flex items-center gap-1 ml-1 bg-black/20 rounded-full px-2 py-0.5 text-[10px] font-black">
                <RefreshCw className="w-2.5 h-2.5" />
                {queueLength}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
