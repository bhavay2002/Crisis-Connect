/**
 * RetryCard — standardized retry UI for failed queries.
 *
 * Drop it into any query error state:
 *   if (isError) return <RetryCard message="Failed to load reports" onRetry={refetch} />;
 *
 * Features:
 *   - Countdown auto-retry (optional): shows "Retrying in 5s…"
 *   - Attempts counter: "Failed 3 times"
 *   - Compact variant for use inside small cards
 *   - Full-page variant for critical loading failures
 *
 * This is the same pattern used in Linear, Vercel, and Datadog for
 * their query/fetch error states — always shows:
 *   1. What failed (clear message)
 *   2. A retry action
 *   3. System state context (attempts, timing)
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { RefreshCw, WifiOff, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  message?:    string;
  detail?:     string;
  onRetry?:    () => void;
  attempts?:   number;
  autoRetry?:  number;  // seconds until auto-retry (0 = no auto-retry)
  compact?:    boolean;
  fullPage?:   boolean;
  offline?:    boolean; // show offline-specific messaging
}

export function RetryCard({
  message    = "Failed to load",
  detail,
  onRetry,
  attempts   = 0,
  autoRetry  = 0,
  compact    = false,
  fullPage   = false,
  offline    = false,
}: Props) {
  const [countdown, setCountdown] = useState(autoRetry);
  const [isRetrying, setIsRetrying] = useState(false);

  // Auto-retry countdown
  useEffect(() => {
    if (!autoRetry || !onRetry) return;
    setCountdown(autoRetry);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onRetry();
          return autoRetry;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRetry, onRetry]);

  const handleRetry = useCallback(async () => {
    if (!onRetry || isRetrying) return;
    setIsRetrying(true);
    try { await Promise.resolve(onRetry()); } finally {
      setTimeout(() => setIsRetrying(false), 600);
    }
  }, [onRetry, isRetrying]);

  const Icon = offline ? WifiOff : AlertTriangle;

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-sm">
        <Icon className="w-4 h-4 text-destructive flex-shrink-0" />
        <span className="flex-1 text-muted-foreground text-xs">{message}</span>
        {onRetry && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={handleRetry} disabled={isRetrying}>
            <RefreshCw className={`w-3 h-3 mr-1 ${isRetrying ? "animate-spin" : ""}`} />
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (fullPage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center"
        >
          <Icon className="w-8 h-8 text-destructive" />
        </motion.div>
        <div>
          <h3 className="font-bold text-lg mb-1">{message}</h3>
          {detail && <p className="text-sm text-muted-foreground max-w-sm">{detail}</p>}
          {offline && <p className="text-xs text-amber-600 mt-1">Check your network connection</p>}
        </div>
        {attempts > 0 && (
          <p className="text-xs text-muted-foreground">
            Failed {attempts} time{attempts > 1 ? "s" : ""}
          </p>
        )}
        {onRetry && (
          <div className="flex items-center gap-3">
            <Button onClick={handleRetry} disabled={isRetrying} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${isRetrying ? "animate-spin" : ""}`} />
              {isRetrying ? "Retrying…" : "Retry"}
            </Button>
            {autoRetry > 0 && countdown > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                Auto-retry in {countdown}s
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default: card style
  return (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-destructive" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{message}</p>
          {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
          {offline && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <WifiOff className="w-3 h-3" />No network connection
            </p>
          )}
        </div>
      </div>
      {attempts > 0 && (
        <p className="text-xs text-muted-foreground pl-11">
          Failed {attempts} time{attempts > 1 ? "s" : ""}
        </p>
      )}
      {onRetry && (
        <div className="flex items-center gap-3 pl-11">
          <Button size="sm" variant="outline" onClick={handleRetry} disabled={isRetrying}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "Retrying…" : "Try Again"}
          </Button>
          {autoRetry > 0 && countdown > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Retrying in {countdown}s
            </span>
          )}
        </div>
      )}
    </div>
  );
}
