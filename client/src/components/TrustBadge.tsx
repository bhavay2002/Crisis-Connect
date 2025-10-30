import { Shield, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

interface TrustBadgeProps {
  consensusScore: number;
  verificationCount: number;
  upvotes: number;
  downvotes: number;
  isConfirmed?: boolean;
  aiValidationScore?: number;
  showDetails?: boolean;
  size?: "sm" | "md" | "lg";
}

export function TrustBadge({
  consensusScore,
  verificationCount,
  upvotes,
  downvotes,
  isConfirmed,
  aiValidationScore,
  showDetails = false,
  size = "md",
}: TrustBadgeProps) {
  const getTrustLevel = () => {
    if (consensusScore >= 80) return { label: "Highly Trusted", variant: "default" as const, icon: ShieldCheck, color: "text-green-600 dark:text-green-400" };
    if (consensusScore >= 60) return { label: "Trusted", variant: "secondary" as const, icon: Shield, color: "text-blue-600 dark:text-blue-400" };
    if (consensusScore >= 40) return { label: "Moderate", variant: "outline" as const, icon: Shield, color: "text-yellow-600 dark:text-yellow-400" };
    if (consensusScore >= 20) return { label: "Low Trust", variant: "destructive" as const, icon: ShieldAlert, color: "text-orange-600 dark:text-orange-400" };
    return { label: "Unverified", variant: "destructive" as const, icon: AlertTriangle, color: "text-red-600 dark:text-red-400" };
  };

  const trustLevel = getTrustLevel();
  const Icon = trustLevel.icon;
  const iconSize = size === "sm" ? 14 : size === "lg" ? 20 : 16;
  
  const netVotes = upvotes - downvotes;

  const tooltipContent = (
    <div className="space-y-2">
      <div className="font-semibold">Consensus Score: {consensusScore}/100</div>
      <div className="space-y-1 text-sm">
        <div>Community Votes: {netVotes > 0 ? `+${netVotes}` : netVotes} ({upvotes} up, {downvotes} down)</div>
        <div>Verifications: {verificationCount}</div>
        {aiValidationScore !== undefined && (
          <div>AI Validation: {aiValidationScore}%</div>
        )}
        {isConfirmed && (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <ShieldCheck size={14} />
            <span>Verified by NGO/Official</span>
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground pt-1 border-t border-border">
        Score combines community votes, verifications, AI analysis, and official confirmation
      </div>
    </div>
  );

  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={trustLevel.variant} className="gap-1" data-testid="badge-trust">
              <Icon size={iconSize} className={trustLevel.color} />
              {trustLevel.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="w-80">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-3 p-4 bg-muted/50 dark:bg-muted/30 rounded-lg" data-testid="trust-details">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={20} className={trustLevel.color} />
          <div>
            <div className="font-semibold">{trustLevel.label}</div>
            <div className="text-sm text-muted-foreground">Consensus Score: {consensusScore}/100</div>
          </div>
        </div>
        {isConfirmed && (
          <Badge variant="default" className="gap-1">
            <ShieldCheck size={14} />
            Official Verification
          </Badge>
        )}
      </div>
      
      <Progress value={consensusScore} className="h-2" />
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground">Community Votes</div>
          <div className="font-semibold" data-testid="text-net-votes">
            {netVotes > 0 ? `+${netVotes}` : netVotes}
          </div>
          <div className="text-xs text-muted-foreground">
            {upvotes} up, {downvotes} down
          </div>
        </div>
        
        <div>
          <div className="text-muted-foreground">Verifications</div>
          <div className="font-semibold" data-testid="text-verifications">{verificationCount}</div>
        </div>
        
        {aiValidationScore !== undefined && (
          <div>
            <div className="text-muted-foreground">AI Validation</div>
            <div className="font-semibold" data-testid="text-ai-score">{aiValidationScore}%</div>
          </div>
        )}
      </div>
    </div>
  );
}
