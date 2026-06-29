/**
 * Route-level suspense skeleton — shown while a lazy page chunk is loading.
 */
import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded-lg" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>

      {/* Content cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/** Inline card-level skeleton for data loading within a page */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}
