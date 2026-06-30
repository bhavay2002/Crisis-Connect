/**
 * StatCard — canonical metric card for dashboards.
 * Replaces 30+ ad-hoc stat blocks across authority/analytics/volunteer pages.
 *
 * Usage:
 *   <StatCard label="Active Incidents" value={42} icon={AlertTriangle} trend="+5 today" severity="critical" />
 *   <StatCard label="Resolved" value={128} icon={CheckCircle} trend="↑ 12%" positive />
 *   <StatCard label="Resources" value="Low" icon={Package} size="sm" />
 */
import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLORS, TYPE, type SeverityLevel } from "@/lib/tokens";
import { MOTION } from "@/lib/motion";

interface StatCardProps {
  label:      string;
  value:      string | number;
  icon?:      LucideIcon;
  trend?:     string;
  positive?:  boolean;          // green trend
  negative?:  boolean;          // red trend
  severity?:  SeverityLevel;    // tints the icon area
  iconColor?: string;           // explicit icon color override (e.g. "text-blue-400")
  iconBg?:    string;           // explicit icon background override (e.g. "bg-blue-900/30")
  size?:      "sm" | "md" | "lg";
  loading?:   boolean;
  className?: string;
  onClick?:   () => void;
}

const SIZE_CONFIG = {
  sm: {
    card:  "p-3 gap-2",
    icon:  "w-7 h-7",
    iconI: "w-3.5 h-3.5",
    value: "text-lg font-black tabular-nums",
    label: "text-xs",
  },
  md: {
    card:  "p-4 gap-3",
    icon:  "w-9 h-9",
    iconI: "w-4 h-4",
    value: "text-2xl font-black tabular-nums",
    label: "text-xs",
  },
  lg: {
    card:  "p-5 gap-3",
    icon:  "w-11 h-11",
    iconI: "w-5 h-5",
    value: "text-3xl font-black tabular-nums",
    label: "text-sm",
  },
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  positive,
  negative,
  severity,
  size     = "md",
  loading  = false,
  className,
  onClick,
}: StatCardProps) {
  const c  = SIZE_CONFIG[size];
  const sv = severity ? COLORS.status[severity] : null;

  const trendColor = positive ? "text-green-400" : negative ? "text-red-400" : "text-muted-foreground";

  const content = (
    <div className={cn("flex items-start", c.card, onClick && "cursor-pointer")}>
      {Icon && (
        <div
          className={cn(
            "flex-shrink-0 rounded-lg flex items-center justify-center",
            c.icon,
            sv ? cn(sv.bg, sv.text) : "bg-slate-800 text-muted-foreground",
          )}
        >
          <Icon className={c.iconI} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className={cn(TYPE.label, c.label, "mb-0.5")}>{label}</p>
        {loading ? (
          <div className="h-7 w-16 rounded bg-slate-800 animate-pulse mt-1" />
        ) : (
          <p className={cn(c.value, "text-foreground leading-none")}>{value}</p>
        )}
        {trend && !loading && (
          <p className={cn("mt-1 text-xs font-medium", trendColor)}>{trend}</p>
        )}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <motion.div
        className={cn(
          "rounded-xl border border-border/50 bg-card hover:border-border transition-colors",
          className,
        )}
        {...MOTION.cardHover}
        onClick={onClick}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card",
        className,
      )}
    >
      {content}
    </div>
  );
}
