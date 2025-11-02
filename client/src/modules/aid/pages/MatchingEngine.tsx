import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Play, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  BarChart3,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { formatDistanceToNow } from "date-fns";
import { useWebSocket } from "@/hooks/useWebSocket";

interface MatchingAnalytics {
  supply: {
    total: number;
    available: number;
    committed: number;
    delivered: number;
    byType: Record<string, number>;
  };
  demand: {
    total: number;
    pending: number;
    inProgress: number;
    fulfilled: number;
    byType: Record<string, number>;
    byUrgency: Record<string, number>;
  };
  gaps: Array<{ resourceType: string; supply: number; demand: number; gap: number }>;
  matchRate: number;
}

interface BatchMatchResult {
  message: string;
  totalRequests: number;
  totalOffers: number;
  matchedRequests: number;
  matches: Array<{
    requestId: string;
    requestType: string;
    requestQuantity: number;
    urgency: string;
    matches: Array<{
      offerId: string;
      score: number;
      distance?: number;
      reasoning: string;
    }>;
  }>;
}

const resourceTypeLabels: Record<string, string> = {
  food: "Food",
  water: "Water",
  shelter: "Shelter",
  medical: "Medical",
  clothing: "Clothing",
  blankets: "Blankets",
  other: "Other",
};

export default function MatchingEngine() {
  const { toast } = useToast();
  const [lastRunTime, setLastRunTime] = useState<Date | null>(null);

  const { data: analytics, isLoading: isLoadingAnalytics, refetch: refetchAnalytics } = useQuery<MatchingAnalytics>({
    queryKey: ["/api/matching/analytics"],
  });

  // Listen for batch matching completion via WebSocket
  useWebSocket({
    onMessage: (message) => {
      if (message.type === "batch_matching_complete") {
        setLastRunTime(new Date(message.data.timestamp));
        refetchAnalytics();
        
        toast({
          title: "Batch Matching Complete",
          description: `Found ${message.data.totalMatches} potential matches. Analytics updated.`,
        });
      }
    },
  });

  const batchMatchMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<BatchMatchResult>("/api/matching/run-batch", { method: "POST" });
    },
    onSuccess: (data: BatchMatchResult) => {
      setLastRunTime(new Date());
      refetchAnalytics();
      queryClient.invalidateQueries({ queryKey: ["/api/aid-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/resource-requests"] });
      
      toast({
        title: "Batch Matching Complete",
        description: `Found ${data.matchedRequests} requests with potential matches out of ${data.totalRequests} pending requests.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Batch Matching Failed",
        description: error.message || "Failed to run batch matching. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRunBatchMatching = () => {
    batchMatchMutation.mutate();
  };

  if (isLoadingAnalytics) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6 space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!analytics) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Analytics</AlertTitle>
            <AlertDescription>
              Failed to load matching engine analytics. Please try refreshing the page.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Zap className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">Matching Engine</h1>
            </div>
            <p className="text-muted-foreground">
              Automated matching system connecting supply with demand
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => refetchAnalytics()}
              size="sm"
              data-testid="button-refresh-analytics"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={handleRunBatchMatching}
              disabled={batchMatchMutation.isPending}
              size="lg"
              data-testid="button-run-matching"
            >
              {batchMatchMutation.isPending ? (
                <>
                  <Clock className="h-5 w-5 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Run Batch Matching
                </>
              )}
            </Button>
          </div>
        </div>

        {lastRunTime && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Last Run</AlertTitle>
            <AlertDescription>
              Batch matching completed {formatDistanceToNow(lastRunTime, { addSuffix: true })}
            </AlertDescription>
          </Alert>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card data-testid="card-match-rate">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Match Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="text-3xl font-bold">{analytics.matchRate}%</div>
                {analytics.matchRate >= 70 ? (
                  <TrendingUp className="h-5 w-5 text-green-600 mb-1" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600 mb-1" />
                )}
              </div>
              <Progress value={analytics.matchRate} className="mt-3" />
              <p className="text-xs text-muted-foreground mt-2">
                {analytics.demand.fulfilled + analytics.demand.inProgress} of {analytics.demand.total} requests matched
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-available-supply">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Available Supply</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="text-3xl font-bold">{analytics.supply.available}</div>
                <Package className="h-5 w-5 text-blue-600 mb-1" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {analytics.supply.total} total offers
              </p>
              <div className="flex gap-2 mt-3">
                <Badge variant="outline" className="text-xs">
                  {analytics.supply.committed} committed
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {analytics.supply.delivered} delivered
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-pending-demand">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Demand</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="text-3xl font-bold">{analytics.demand.pending}</div>
                <AlertTriangle className="h-5 w-5 text-orange-600 mb-1" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {analytics.demand.total} total requests
              </p>
              <div className="flex gap-2 mt-3">
                <Badge variant="outline" className="text-xs">
                  {analytics.demand.inProgress} in progress
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {analytics.demand.fulfilled} fulfilled
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-critical-gaps">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Supply Gaps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="text-3xl font-bold">{analytics.gaps.length}</div>
                <BarChart3 className="h-5 w-5 text-red-600 mb-1" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Resource types with unmet demand
              </p>
              {analytics.gaps.length > 0 && (
                <Badge variant="destructive" className="mt-3">
                  Attention Required
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Supply vs Demand by Type */}
        <Card data-testid="card-supply-demand">
          <CardHeader>
            <CardTitle>Supply vs Demand by Resource Type</CardTitle>
            <CardDescription>
              Compare available resources with pending requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.keys({ ...analytics.supply.byType, ...analytics.demand.byType }).map((type) => {
                const supply = analytics.supply.byType[type] || 0;
                const demand = analytics.demand.byType[type] || 0;
                const total = Math.max(supply, demand) || 1;
                const supplyPercent = (supply / total) * 100;
                const demandPercent = (demand / total) * 100;
                const hasGap = demand > supply;

                return (
                  <div key={type} className="space-y-2" data-testid={`supply-demand-${type}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{resourceTypeLabels[type] || type}</span>
                        {hasGap && (
                          <Badge variant="destructive" className="text-xs">
                            Gap: {demand - supply} units
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="text-muted-foreground">Supply: {supply}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-orange-500" />
                          <span className="text-muted-foreground">Demand: {demand}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 h-8">
                      <div 
                        className="bg-blue-500 rounded flex items-center justify-center text-xs text-white font-medium"
                        style={{ width: `${supplyPercent}%` }}
                      >
                        {supply > 0 && `${supply}`}
                      </div>
                      <div 
                        className="bg-orange-500 rounded flex items-center justify-center text-xs text-white font-medium"
                        style={{ width: `${demandPercent}%` }}
                      >
                        {demand > 0 && `${demand}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Supply Gaps */}
        {analytics.gaps.length > 0 && (
          <Card data-testid="card-gaps-detail">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Critical Supply Gaps
              </CardTitle>
              <CardDescription>
                Resource types where demand exceeds supply - immediate action needed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.gaps.map((gap) => (
                  <Alert key={gap.resourceType} variant="destructive">
                    <AlertTitle className="capitalize">{resourceTypeLabels[gap.resourceType] || gap.resourceType}</AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Available Supply:</span>
                          <span className="font-medium">{gap.supply} units</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Pending Demand:</span>
                          <span className="font-medium">{gap.demand} units</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold border-t pt-1 mt-2">
                          <span>Shortage:</span>
                          <span className="text-red-600">{gap.gap} units needed</span>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Demand by Urgency */}
        <Card data-testid="card-urgency-breakdown">
          <CardHeader>
            <CardTitle>Demand by Urgency Level</CardTitle>
            <CardDescription>
              Breakdown of pending requests by urgency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {["critical", "high", "medium", "low"].map((urgency) => {
                const count = analytics.demand.byUrgency[urgency] || 0;
                const color = 
                  urgency === "critical" ? "text-red-600" :
                  urgency === "high" ? "text-orange-600" :
                  urgency === "medium" ? "text-yellow-600" :
                  "text-blue-600";

                return (
                  <div key={urgency} className="p-4 border rounded-lg" data-testid={`urgency-${urgency}`}>
                    <div className="text-sm text-muted-foreground capitalize mb-1">{urgency}</div>
                    <div className={`text-2xl font-bold ${color}`}>{count}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
