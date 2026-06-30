/**
 * SeverityBadge — canonical severity/priority pill.
 * Replaces 50+ ad-hoc color maps scattered across the codebase.
 *
 * Usage:
 *   <SeverityBadge level="critical" />
 *   <SeverityBadge level="high" pulse />
 *   <SeverityBadge level="medium" size="sm" />
 */
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { COLORS, type SeverityLevel } from "@/lib/tokens";
import { MOTION } from "@/lib/motion";

interface SeverityBadgeProps {
  level:    SeverityLevel;
  pulse?:   boolean;
  size?:    "sm" | "md" | "lg";
  dot?:     boolean;
  className?: string;
}

const SIZE = {
  sm: "px-1.5 py-0.5 text-[10px] gap-1",
  md: "px-2.5 py-1   text-xs     gap-1.5",
  lg: "px-3   py-1.5 text-sm     gap-2",
} as const;

const DOT_SIZE = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
  lg: "w-2.5 h-2.5",
} as const;

export function SeverityBadge({
  level,
  pulse = level === "critical",
  size  = "md",
  dot   = true,
  className,
}: SeverityBadgeProps) {
  const s = COLORS.status[level];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold tracking-wide uppercase",
        SIZE[size],
        s.bg, s.text, s.border,
        className,
      )}
    >
      {dot && (
        <motion.span
          className={cn("rounded-full flex-shrink-0", DOT_SIZE[size], s.dot)}
          animate={pulse ? MOTION.criticalPulse : undefined}
        />
      )}
      {level}
    </span>
  );
}
