import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, CheckCircle, AlertTriangle, Flame, Droplets, ThumbsUp, ShieldCheck } from "lucide-react";
import { VotingControls } from "./VotingControls";
import { TrustBadge } from "./TrustBadge";

interface DisasterReport {
  id: string;
  title: string;
  type: "fire" | "flood" | "earthquake" | "storm" | "accident" | "other";
  severity: "low" | "medium" | "high" | "critical";
  location: string;
  description: string;
  timestamp: string;
  verificationCount: number;
  upvotes: number;
  downvotes: number;
  consensusScore: number;
  status: "reported" | "verified" | "responding" | "resolved";
  confirmedBy?: string | null;
  confirmedAt?: Date | null;
  aiValidationScore?: number | null;
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

const typeIcons = {
  fire: Flame,
  flood: Droplets,
  earthquake: AlertTriangle,
  storm: AlertTriangle,
  accident: AlertTriangle,
  other: AlertTriangle,
};

const severityColors = {
  low: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};

const statusColors = {
  reported: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
  verified: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  responding: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  resolved: "bg-green-500/10 text-green-700 dark:text-green-400",
};

export default function DisasterReportCard({
  report,
  onVerify,
  onConfirm,
  onViewDetails,
  userRole,
  canConfirm,
  hasVerified,
}: DisasterReportCardProps) {
  const TypeIcon = typeIcons[report.type];
  const isConfirmed = !!report.confirmedBy;

  return (
    <Card
      className={`border-l-4 ${report.severity === "critical" ? "border-l-destructive" : report.severity === "high" ? "border-l-orange-500" : report.severity === "medium" ? "border-l-yellow-500" : "border-l-blue-500"}`}
      data-testid={`card-report-${report.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-md ${severityColors[report.severity]}`}>
              <TypeIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg leading-tight" data-testid={`text-title-${report.id}`}>
                {report.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="secondary" className={statusColors[report.status]} data-testid={`badge-status-${report.id}`}>
                  {report.status.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-xs uppercase font-semibold">
                  {report.severity}
                </Badge>
                <TrustBadge
                  consensusScore={report.consensusScore}
                  verificationCount={report.verificationCount}
                  upvotes={report.upvotes}
                  downvotes={report.downvotes}
                  isConfirmed={isConfirmed}
                  aiValidationScore={report.aiValidationScore || undefined}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {report.description}
        </p>
        <div className="flex flex-wrap gap-3 text-sm mb-3">
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="text-xs">{report.location}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-xs">{report.timestamp}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs">{report.verificationCount} verifications</span>
          </div>
        </div>
        <VotingControls
          reportId={report.id}
          initialUpvotes={report.upvotes}
          initialDownvotes={report.downvotes}
          size="sm"
        />
      </CardContent>
      <CardFooter className="flex gap-2 flex-wrap">
        <Button
          variant={hasVerified ? "default" : "outline"}
          size="sm"
          onClick={onVerify}
          disabled={hasVerified}
          data-testid={`button-verify-${report.id}`}
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          {hasVerified ? "Verified" : "Verify"}
        </Button>
        {canConfirm && (
          <Button
            variant={isConfirmed ? "default" : "outline"}
            size="sm"
            onClick={onConfirm}
            className={isConfirmed ? "bg-green-600 hover:bg-green-700" : ""}
            data-testid={`button-confirm-${report.id}`}
          >
            <ShieldCheck className="w-4 h-4 mr-1" />
            {isConfirmed ? "Confirmed" : "Confirm"}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onViewDetails}
          data-testid={`button-details-${report.id}`}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}
