/**
 * SectionHeader — consistent page and section-level header.
 *
 * Usage:
 *   <SectionHeader title="Active Reports" />
 *   <SectionHeader title="Live Feed" description="Updates every 30s" badge={count} live />
 *   <SectionHeader title="Analytics" actions={<Button>Export</Button>} />
 *   <SectionHeader title="Policy Engine" icon={Settings} iconColor="text-blue-400" iconBg="bg-blue-900/30" />
 */
import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/tokens";
import { LiveIndicator } from "./LiveIndicator";
import { MOTION } from "@/lib/motion";

interface SectionHeaderProps {
  title:        string;
  description?: string;
  subtitle?:    string;
  badge?:       number | string;
  live?:        boolean;
  actions?:     React.ReactNode;
  rightSlot?:   React.ReactNode;
  icon?:        LucideIcon;
  iconColor?:   string;
  iconBg?:      string;
  size?:        "sm" | "md" | "lg";
  className?:   string;
}

const TITLE_SIZE = {
  sm: "text-sm font-semibold",
  md: "text-base font-semibold",
  lg: "text-xl font-bold",
} as const;

export function SectionHeader({
  title,
  description,
  subtitle,
  badge,
  live,
  actions,
  rightSlot,
  icon: Icon,
  iconColor,
  iconBg,
  size      = "md",
  className,
}: SectionHeaderProps) {
  const desc  = description ?? subtitle;
  const right = actions ?? rightSlot;

  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className={cn(
            "flex-shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center",
            iconBg ?? "bg-slate-800/60 border-slate-700/50",
          )}>
            <Icon className={cn("w-4.5 h-4.5", iconColor ?? "text-muted-foreground")} />
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className={cn(TITLE_SIZE[size], "text-foreground leading-snug truncate")}>
              {title}
            </h2>

            {badge !== undefined && badge !== null && (
              <motion.span
                key={String(badge)}
                {...MOTION.springPop}
                className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums"
              >
                {badge}
              </motion.span>
            )}

            {live && <LiveIndicator size="sm" />}
          </div>

          {desc && (
            <p className={cn(TYPE.caption, "mt-0.5 hidden sm:block")}>{desc}</p>
          )}
        </div>
      </div>

      {right && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {right}
        </div>
      )}
    </div>
  );
}
