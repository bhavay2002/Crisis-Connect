/**
 * EmptyState — consistent zero-data states across all sections.
 *
 * Usage:
 *   <EmptyState icon={CheckCircle} title="All clear" description="No active incidents" />
 *   <EmptyState icon={Search} title="No results" description="Try a different filter" action={<Button>Reset</Button>} />
 *   <EmptyState icon={Wifi} title="Connecting…" loading />
 */
import { motion } from "framer-motion";
import { type LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/tokens";
import { MOTION } from "@/lib/motion";

interface EmptyStateProps {
  icon?:        LucideIcon;
  title:        string;
  description?: string;
  action?:      React.ReactNode;
  loading?:     boolean;
  size?:        "sm" | "md" | "lg";
  className?:   string;
}

const SIZE_CONFIG = {
  sm: { wrap: "py-6 gap-2",  icon: "w-7 h-7", iconWrap: "w-10 h-10", title: "text-sm font-semibold" },
  md: { wrap: "py-10 gap-3", icon: "w-8 h-8", iconWrap: "w-12 h-12", title: "text-base font-semibold" },
  lg: { wrap: "py-16 gap-3", icon: "w-10 h-10", iconWrap: "w-16 h-16", title: "text-lg font-bold" },
} as const;

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  loading = false,
  size    = "md",
  className,
}: EmptyStateProps) {
  const c = SIZE_CONFIG[size];

  return (
    <motion.div
      {...MOTION.fadeUp}
      className={cn("flex flex-col items-center justify-center text-center w-full", c.wrap, className)}
    >
      <div
        className={cn(
          "rounded-2xl bg-slate-800/60 flex items-center justify-center flex-shrink-0",
          c.iconWrap,
          loading && "animate-pulse",
        )}
      >
        {loading ? (
          <motion.span
            className={cn("rounded-full bg-slate-600", c.icon)}
            animate={MOTION.spin}
          />
        ) : (
          <Icon className={cn(c.icon, "text-muted-foreground")} strokeWidth={1.5} />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <p className={cn(c.title, "text-foreground")}>{title}</p>
        {description && (
          <p className={cn(TYPE.caption, "max-w-xs")}>{description}</p>
        )}
      </div>

      {action && <div className="mt-1">{action}</div>}
    </motion.div>
  );
}
