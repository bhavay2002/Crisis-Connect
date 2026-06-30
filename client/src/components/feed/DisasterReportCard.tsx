/**
 * DisasterReportCard — React.memo wrapped with a custom equality check.
 * Only re-renders when the visible fields actually change.
 * Anti-pattern avoided: without memo, every WS message caused the entire
 * report list to re-render even when nothing changed on a given card.
 */
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, ThumbsUp, ShieldCheck, Flame, Droplets, AlertTriangle, Zap, Wind, Activity, Radio } from "lucide-react";
import { FakeDetectionBadge } from "@/components/FakeDetectionBadge";

interface DisasterReport {
  id: string;
  title: string;
  type: "fire" | "flood" | "earthquake" | "storm" | "road_accident" | "epidemic" | "landslide" | "gas_leak" | "building_collapse" | "chemical_spill" | "power_outage" | "water_contamination" | "other";
  severity: "low" | "medium" | "high" | "critical";
  location: string;
  description: string;
  timestamp: string;
  verificationCount: number;
  status: "reported" | "verified" | "responding" | "resolved";
  confirmedBy?: string | null;
  confirmedAt?: Date | null;
  fakeDetectionScore?: number | null;
  fakeDetectionFlags?: string[] | null;
}

interface DisasterReportCardProps {
  report: DisasterReport;
  onVerify?: () => void;
  onConfirm?: () => void;
  onViewDetails?: () => void;
  userRole?: string | null;
  canConfirm?: boolean;
  hasVerified?: boolean;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  fire:               { icon: Flame,         color: "text-red-500",    bg: "bg-red-500/10",    label: "Fire"               },
  flood:              { icon: Droplets,      color: "text-blue-500",   bg: "bg-blue-500/10",   label: "Flood"              },
  earthquake:         { icon: Activity,      color: "text-orange-500", bg: "bg-orange-500/10", label: "Earthquake"         },
  storm:              { icon: Wind,          color: "text-cyan-500",   bg: "bg-cyan-500/10",   label: "Storm"              },
  road_accident:      { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Road Accident"      },
  epidemic:           { icon: Radio,         color: "text-purple-500", bg: "bg-purple-500/10", label: "Epidemic"           },
  landslide:          { icon: AlertTriangle, color: "text-amber-500",  bg: "bg-amber-500/10",  label: "Landslide"          },
  gas_leak:           { icon: Zap,           color: "text-yellow-600", bg: "bg-yellow-600/10", label: "Gas Leak"           },
  building_collapse:  { icon: AlertTriangle, color: "text-red-600",    bg: "bg-red-600/10",    label: "Building Collapse"  },
  chemical_spill:     { icon: Activity,      color: "text-green-600",  bg: "bg-green-600/10",  label: "Chemical Spill"     },
  power_outage:       { icon: Zap,           color: "text-slate-500",  bg: "bg-slate-500/10",  label: "Power Outage"       },
  water_contamination:{ icon: Droplets,      color: "text-teal-500",   bg: "bg-teal-500/10",   label: "Water Contamination"},
  other:              { icon: AlertTriangle, color: "text-slate-400",  bg: "bg-slate-400/10",  label: "Other"              },
};

const SEV_CONFIG = {
  low:      { bar: "bg-blue-500",   badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300",     dot: "bg-blue-500"          },
  medium:   { bar: "bg-yellow-500", badge: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300", dot: "bg-yellow-500" },
  high:     { bar: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300", dot: "bg-orange-500" },
  critical: { bar: "bg-red-500",    badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300",           dot: "bg-red-500 animate-pulse" },
};

const STATUS_CONFIG = {
  reported:  { label: "Reported",   cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"   },
  verified:  { label: "Verified",   cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"        },
  responding:{ label: "Responding", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"    },
  resolved:  { label: "Resolved",   cls: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"    },
};

function DisasterReportCardInner({
  report, onVerify, onConfirm, onViewDetails, userRole, canConfirm, hasVerified,
}: DisasterReportCardProps) {
  const t       = TYPE_CONFIG[report.type] || TYPE_CONFIG.other;
  const sev     = SEV_CONFIG[report.severity];
  const status  = STATUS_CONFIG[report.status];
  const Icon    = t.icon;
  const isConfirmed = !!report.confirmedBy;

  return (
    <div
      className="group relative bg-background rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
      data-testid={`card-report-${report.id}`}
    >
      {/* Severity stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${sev.bar}`} />

      <div className="pl-4 p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div className={`w-9 h-9 rounded-lg ${t.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
              <Icon className={`w-4 h-4 ${t.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm leading-snug line-clamp-1" data-testid={`text-title-${report.id}`}>
                {report.title}
              </h3>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{t.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`w-2 h-2 rounded-full ${sev.dot}`} />
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide ${sev.badge}`} data-testid={`badge-severity-${report.id}`}>
              {report.severity}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
          {report.description}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{report.location}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{report.timestamp}</span>
          <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{report.verificationCount}</span>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.cls}`} data-testid={`badge-status-${report.id}`}>
            {status.label}
          </span>
          {isConfirmed && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 flex items-center gap-1" data-testid={`badge-confirmed-${report.id}`}>
              <ShieldCheck className="w-3 h-3" />Confirmed
            </span>
          )}
          <FakeDetectionBadge score={report.fakeDetectionScore} flags={report.fakeDetectionFlags} compact />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant={hasVerified ? "default" : "outline"} className="h-7 text-xs px-3"
            onClick={onVerify} disabled={hasVerified} data-testid={`button-upvote-${report.id}`}>
            <ThumbsUp className="w-3 h-3 mr-1" />
            {hasVerified ? "Upvoted" : "Upvote"}
          </Button>
          {canConfirm && (
            <Button size="sm" variant={isConfirmed ? "default" : "outline"}
              className={`h-7 text-xs px-3 ${isConfirmed ? "bg-green-600 hover:bg-green-700 border-0" : ""}`}
              onClick={onConfirm} data-testid={`button-confirm-${report.id}`}>
              <ShieldCheck className="w-3 h-3 mr-1" />
              {isConfirmed ? "Confirmed" : "Confirm"}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs px-3 ml-auto text-muted-foreground hover:text-foreground"
            onClick={onViewDetails} data-testid={`button-details-${report.id}`}>
            Details →
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Custom equality — card only re-renders when its own visible data changes.
 * A WS ping or unrelated report update will NOT cause this card to re-render.
 */
function areEqual(prev: DisasterReportCardProps, next: DisasterReportCardProps): boolean {
  return (
    prev.report.id                === next.report.id &&
    prev.report.status            === next.report.status &&
    prev.report.severity          === next.report.severity &&
    prev.report.verificationCount === next.report.verificationCount &&
    prev.report.confirmedBy       === next.report.confirmedBy &&
    prev.hasVerified              === next.hasVerified &&
    prev.canConfirm               === next.canConfirm
  );
}

export default React.memo(DisasterReportCardInner, areEqual);
