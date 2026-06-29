/**
 * Reusable empty-state component replacing ad-hoc "no data" divs.
 */
import type { ReactNode, ElementType } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  iconClassName?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  iconClassName,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 rounded-2xl border-2 border-dashed text-center",
        className
      )}
    >
      {Icon && (
        <div className={cn("w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4", iconClassName)}>
          <Icon className="w-7 h-7 text-muted-foreground/60" />
        </div>
      )}
      <p className="font-semibold text-foreground mb-1">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
