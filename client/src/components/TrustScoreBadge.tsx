import { Badge } from "@/components/ui/badge";
import { Shield, Award, AlertTriangle } from "lucide-react";

interface TrustScoreBadgeProps {
  score: number;
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
}

export default function TrustScoreBadge({ score, size = "default", showLabel = true }: TrustScoreBadgeProps) {
  const getTrustLevel = (score: number) => {
    if (score >= 80) {
      return {
        label: "Excellent",
        variant: "default" as const,
        icon: Award,
        color: "text-green-600",
        bgColor: "bg-green-100",
      };
    }
    if (score >= 60) {
      return {
        label: "Good",
        variant: "secondary" as const,
        icon: Shield,
        color: "text-blue-600",
        bgColor: "bg-blue-100",
      };
    }
    if (score >= 40) {
      return {
        label: "Average",
        variant: "secondary" as const,
        icon: Shield,
        color: "text-yellow-600",
        bgColor: "bg-yellow-100",
      };
    }
    return {
      label: "New",
      variant: "outline" as const,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    };
  };

  const trust = getTrustLevel(score);
  const Icon = trust.icon;
  
  const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const textSize = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";

  return (
    <Badge 
      variant={trust.variant}
      className={`gap-1 ${trust.bgColor} ${trust.color} ${textSize}`}
      data-testid={`badge-trust-score-${trust.label.toLowerCase()}`}
    >
      <Icon className={iconSize} />
      {showLabel && <span>{trust.label}</span>}
      <span className="font-bold">{score}</span>
    </Badge>
  );
}
