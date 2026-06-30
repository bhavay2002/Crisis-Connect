import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: { value: string; isPositive: boolean };
  color?: "red" | "blue" | "green" | "orange" | "purple" | "slate";
}

const COLOR_MAP = {
  red:    { bg: "bg-red-500/10",    icon: "text-red-500",    border: "border-red-500/20"    },
  blue:   { bg: "bg-blue-500/10",   icon: "text-blue-500",   border: "border-blue-500/20"   },
  green:  { bg: "bg-green-500/10",  icon: "text-green-500",  border: "border-green-500/20"  },
  orange: { bg: "bg-orange-500/10", icon: "text-orange-500", border: "border-orange-500/20" },
  purple: { bg: "bg-purple-500/10", icon: "text-purple-500", border: "border-purple-500/20" },
  slate:  { bg: "bg-slate-500/10",  icon: "text-slate-500",  border: "border-slate-500/20"  },
};

export default function StatsCard({ title, value, icon: Icon, description, trend, color = "blue" }: StatsCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-background border p-5 shadow-sm hover:shadow-md transition-shadow`}
      data-testid={`card-stats-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
          <p className="text-3xl font-black text-foreground" data-testid={`text-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </p>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${trend.isPositive ? "text-green-600" : "text-red-600"}`}>
              {trend.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend.value}
            </div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
    </div>
  );
}
