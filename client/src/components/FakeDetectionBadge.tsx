import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Shield, ShieldCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FakeDetectionBadgeProps {
  score?: number | null;
  flags?: string[] | null;
  compact?: boolean;
}

export function FakeDetectionBadge({
  score,
  flags,
  compact = false,
}: FakeDetectionBadgeProps) {
  if (!score && score !== 0) {
    return null;
  }

  const getRiskLevel = (score: number): "low" | "medium" | "high" | "critical" => {
    if (score >= 75) return "critical";
    if (score >= 50) return "high";
    if (score >= 25) return "medium";
    return "low";
  };

  const riskLevel = getRiskLevel(score);

  const getBadgeVariant = () => {
    switch (riskLevel) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "outline";
      case "low":
        return "secondary";
    }
  };

  const getBadgeColor = () => {
    switch (riskLevel) {
      case "critical":
        return "bg-red-600 text-white dark:bg-red-700";
      case "high":
        return "bg-orange-500 text-white dark:bg-orange-600";
      case "medium":
        return "bg-yellow-500 text-black dark:bg-yellow-600 dark:text-white";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    }
  };

  const getIcon = () => {
    switch (riskLevel) {
      case "critical":
      case "high":
        return <ShieldAlert className="h-3 w-3" />;
      case "medium":
        return <Shield className="h-3 w-3" />;
      case "low":
        return <ShieldCheck className="h-3 w-3" />;
    }
  };

  const getLabel = () => {
    if (compact) {
      return `${score}%`;
    }
    switch (riskLevel) {
      case "critical":
        return `Critical Risk (${score}%)`;
      case "high":
        return `High Risk (${score}%)`;
      case "medium":
        return `Medium Risk (${score}%)`;
      case "low":
        return `Low Risk (${score}%)`;
    }
  };

  const getTooltipContent = () => {
    if (!flags || flags.length === 0) {
      return "No suspicious patterns detected";
    }

    const readableFlags = flags.map((flag) =>
      flag.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
    );

    return (
      <div className="space-y-1">
        <p className="font-semibold">Detected Issues:</p>
        <ul className="list-disc list-inside space-y-0.5">
          {readableFlags.map((flag, index) => (
            <li key={index} className="text-xs">
              {flag}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  if (riskLevel === "low" && compact) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={getBadgeVariant()}
          className={`${getBadgeColor()} gap-1 cursor-help`}
          data-testid={`badge-fake-detection-${riskLevel}`}
        >
          {getIcon()}
          <span>{getLabel()}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {getTooltipContent()}
      </TooltipContent>
    </Tooltip>
  );
}
