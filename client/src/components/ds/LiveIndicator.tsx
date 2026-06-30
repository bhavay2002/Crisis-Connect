/**
 * LiveIndicator — pulsing live/connected status dot.
 *
 * Usage:
 *   <LiveIndicator />                    — green pulsing "Live"
 *   <LiveIndicator active={false} />     — grey "Offline"
 *   <LiveIndicator label="Tracking" />
 *   <LiveIndicator size="lg" />
 */
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MOTION } from "@/lib/motion";

interface LiveIndicatorProps {
  active?:    boolean;
  label?:     string | false;
  size?:      "sm" | "md" | "lg";
  className?: string;
}

const DOT = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
  lg: "w-2.5 h-2.5",
} as const;

const TEXT = {
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
} as const;

export function LiveIndicator({
  active    = true,
  label,
  size      = "md",
  className,
}: LiveIndicatorProps) {
  const showLabel = label !== false;
  const defaultLabel = active ? "Live" : "Offline";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <motion.span
        className={cn(
          "rounded-full flex-shrink-0",
          DOT[size],
          active ? "bg-green-500" : "bg-slate-500",
        )}
        animate={active ? MOTION.livePulse : undefined}
      />
      {showLabel && (
        <span
          className={cn(
            TEXT[size],
            "font-semibold tracking-wide uppercase",
            active ? "text-green-500" : "text-slate-500",
          )}
        >
          {label ?? defaultLabel}
        </span>
      )}
    </span>
  );
}
