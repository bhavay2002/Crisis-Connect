/**
 * OfflineQueueBadge — queued action indicator.
 *
 * Shows when there are pending SOS requests queued offline.
 * Appears as a fixed badge at bottom-left — does not interrupt flow.
 *
 * States:
 *   - Offline + queue > 0  → amber badge with count + "will sync"
 *   - Online + syncing     → animated "Syncing N requests…"
 *   - Just synced          → green "Synced" (auto-dismisses in 2s)
 *   - Idle (empty queue)   → hidden
 *
 * This gives users confidence that offline actions won't be lost —
 * critical for the SOS flow where citizens may be in low-signal areas.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, CheckCircle, WifiOff } from "lucide-react";
import { useOfflineSync } from "@/context/OfflineSyncContext";
import { useNetworkStatus } from "@/shared/hooks/useNetworkStatus";

export function OfflineQueueBadge() {
  const { queueLength, isSyncing, lastSyncAt } = useOfflineSync();
  const isOnline = useNetworkStatus();
  const [showSynced, setShowSynced] = useState(false);

  // Flash "Synced" briefly after a successful sync
  useEffect(() => {
    if (lastSyncAt && !isSyncing && queueLength === 0) {
      setShowSynced(true);
      const t = setTimeout(() => setShowSynced(false), 2000);
      return () => clearTimeout(t);
    }
  }, [lastSyncAt, isSyncing, queueLength]);

  const visible = queueLength > 0 || isSyncing || showSynced;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-5 left-5 z-50"
        >
          <div className={`
            flex items-center gap-2 px-3 py-2 rounded-xl shadow-xl text-xs font-semibold
            border backdrop-blur-sm
            ${showSynced
              ? "bg-green-950 border-green-800 text-green-300"
              : isSyncing
              ? "bg-blue-950 border-blue-800 text-blue-300"
              : "bg-amber-950 border-amber-800 text-amber-300"}
          `}>
            {showSynced ? (
              <><CheckCircle className="w-3.5 h-3.5 text-green-400" />Synced</>
            ) : isSyncing ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />Syncing {queueLength} request{queueLength > 1 ? "s" : ""}…</>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                {queueLength} queued — will send when online
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
