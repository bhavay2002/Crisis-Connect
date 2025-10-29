import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Package, Droplet, Home, Plus, Shirt, HelpCircle, Wind, ArrowLeft, Sparkles, MapPin, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AidOffer } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface Match {
  requestId: string;
  offerId: string;
  score: number;
  distance?: number;
  reasoning: string;
}

interface ResourceRequest {
  id: string;
  resourceType: string;
  quantity: number;
  urgency: string;
  status: string;
  description?: string;
  location: string;
  contactInfo?: string;
  userId: string;
  disasterReportId?: string;
  createdAt: string;
}

const resourceIcons = {
  food: Package,
  water: Droplet,
  shelter: Home,
  medical: Plus,
  clothing: Shirt,
  blankets: Wind,
  other: HelpCircle,
};

const urgencyColors = {
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-blue-600 dark:text-blue-400";
  if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-gray-600 dark:text-gray-400";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent Match";
  if (score >= 60) return "Good Match";
  if (score >= 40) return "Fair Match";
  return "Possible Match";
}

export default function AidOfferMatches() {
  const { offerId } = useParams<{ offerId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: offer, isLoading: isLoadingOffer } = useQuery<AidOffer>({
    queryKey: ["/api/aid-offers", offerId],
  });

  const { data: matches = [], isLoading: isLoadingMatches } = useQuery<Match[]>({
    queryKey: ["/api/aid-offers", offerId, "matches"],
    enabled: !!offer,
  });

  const { data: allRequests = [] } = useQuery<ResourceRequest[]>({
    queryKey: ["/api/resource-requests"],
    enabled: matches.length > 0,
  });

  const commitMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/aid-offers/${offerId}/commit`, { requestId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aid-offers"] });
      toast({
        title: "Aid Committed",
        description: "You've committed to help fulfill this request!",
      });
      navigate("/aid-offers");
    },
    onError: (error: any) => {
      toast({
        title: "Commitment Failed",
        description: error.message || "Failed to commit aid offer. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoadingOffer) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium text-muted-foreground">Aid offer not found</p>
            <Button onClick={() => navigate("/aid-offers")} className="mt-4">
              Back to Aid Offers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ResourceIcon = resourceIcons[offer.resourceType as keyof typeof resourceIcons];

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/aid-offers")}
        className="mb-6"
        data-testid="button-back"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Aid Offers
      </Button>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">AI-Powered Matches</h1>
        </div>
        <p className="text-muted-foreground">
          Based on your offer, we've found these resource requests that need help
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ResourceIcon className="h-5 w-5" />
            Your Aid Offer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Resource Type</p>
              <p className="font-medium capitalize">{offer.resourceType}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Quantity</p>
              <p className="font-medium">{offer.quantity} units</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground mb-1">Location</p>
              <p className="font-medium">{offer.location}</p>
            </div>
            {offer.description && (
              <div className="col-span-2">
                <p className="text-muted-foreground mb-1">Description</p>
                <p className="font-medium">{offer.description}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Recommended Matches ({matches.length})
        </h2>

        {isLoadingMatches ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : matches.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-2">No Matches Found</p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                There are currently no pending resource requests that match your offer. Check back later!
              </p>
            </CardContent>
          </Card>
        ) : (
          matches.map((match) => {
            const request = allRequests.find((r) => r.id === match.requestId);
            if (!request) return null;

            const RequestIcon = resourceIcons[request.resourceType as keyof typeof resourceIcons];

            return (
              <Card key={match.requestId} className="hover-elevate" data-testid={`card-match-${match.requestId}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <RequestIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg mb-1 capitalize">
                          {request.resourceType} Request
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {request.description}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={urgencyColors[request.urgency as keyof typeof urgencyColors]}>
                      {request.urgency}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Match Score</span>
                      <span className={`text-lg font-bold ${getScoreColor(match.score)}`}>
                        {match.score}%
                      </span>
                    </div>
                    <Progress value={match.score} className="h-2" />
                    <p className="text-sm text-muted-foreground">{getScoreLabel(match.score)}</p>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm font-medium mb-2">AI Analysis</p>
                      <p className="text-sm text-muted-foreground">{match.reasoning}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Quantity Needed</p>
                        <p className="font-medium">{request.quantity} units</p>
                      </div>
                      {match.distance !== undefined && (
                        <div>
                          <p className="text-muted-foreground mb-1 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            Distance
                          </p>
                          <p className="font-medium">{match.distance.toFixed(1)} km</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-muted-foreground mb-1">Location</p>
                        <p className="font-medium">{request.location}</p>
                      </div>
                      {request.contactInfo && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground mb-1">Contact</p>
                          <p className="font-medium">{request.contactInfo}</p>
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => commitMutation.mutate(request.id)}
                      disabled={commitMutation.isPending}
                      data-testid={`button-commit-${match.requestId}`}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {commitMutation.isPending ? "Committing..." : "Commit to Help"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
