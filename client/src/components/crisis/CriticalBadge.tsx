import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CriticalBadgeProps {
  severity: "critical" | "high" | "medium" | "low" | string;
  className?: string;
  pulse?: boolean;
}

const SEV_STYLES: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high:     "bg-orange-500 text-white",
  medium:   "bg-yellow-500 text-white",
  low:      "bg-blue-500 text-white",
};

export function CriticalBadge({ severity, className, pulse = false }: CriticalBadgeProps) {
  const style = SEV_STYLES[severity] ?? "bg-slate-500 text-white";
  const isCritical = severity === "critical";

  if (isCritical && pulse) {
    return (
      <motion.span
        animate={{ opacity: [1, 0.45, 1] }}
        transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide",
          style,
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white" />
        {severity}
      </motion.span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide",
        style,
        className
      )}
    >
      {severity}
    </span>
  );
}
