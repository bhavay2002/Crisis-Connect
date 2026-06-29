/**
 * Consistent page header used across all feature pages.
 * Eliminates the repeated header pattern copy-pasted into every page.
 */
import type { ReactNode, ElementType } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ElementType;
  iconColor?: string;
  iconBg?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = "text-red-500",
  iconBg = "bg-red-500/10",
  actions,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
            <Icon className={cn("w-5 h-5", iconColor)} />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight">{title}</h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}
