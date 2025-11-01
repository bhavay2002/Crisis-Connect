import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Package, Droplet, Home, Plus, Shirt, HelpCircle, Wind, CheckCircle2, XCircle, AlertTriangle, ArrowRight, MapPin, Phone, User, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AidOffer, ResourceRequest } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

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

interface MatchCardProps {
  offer: AidOffer;
  request: ResourceRequest;
  onCommit: (offerId: string, requestId: string) => void;
  onDeliver: (offerId: string) => void;
  isCommitting: boolean;
  isDelivering: boolean;
}

function MatchCard({ offer, request, onCommit, onDeliver, isCommitting, isDelivering }: MatchCardProps) {
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [showDeliverDialog, setShowDeliverDialog] = useState(false);
  const ResourceIcon = resourceIcons[request.resourceType];

  const handleCommit = () => {
    onCommit(offer.id, request.id);
    setShowCommitDialog(false);
  };

  const handleDeliver = () => {
    onDeliver(offer.id);
    setShowDeliverDialog(false);
  };

  return (
    <>
      <Card className="hover-elevate" data-testid={`card-match-${offer.id}-${request.id}`}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-primary/10">
                <ResourceIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg mb-1">
                  Match Found: {request.resourceType.charAt(0).toUpperCase() + request.resourceType.slice(1)}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  Your offer matches a help request
                </CardDescription>
              </div>
            </div>
            <Badge className={urgencyColors[request.urgency]} data-testid={`badge-urgency-${request.id}`}>
              {request.urgency} urgency
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-sm text-green-900 dark:text-green-100">
                Your offer of <strong>{offer.quantity} units</strong> matches this request for <strong>{request.quantity} units</strong>
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Help Request Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Description</p>
                    <p className="font-medium">{request.description || "No description provided"}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-medium" data-testid={`text-request-location-${request.id}`}>{request.location}</p>
                    </div>
                  </div>
                  {request.contactInfo && (
                    <div className="flex items-start gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-muted-foreground">Contact</p>
                        <p className="font-medium" data-testid={`text-request-contact-${request.id}`}>{request.contactInfo}</p>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Requested {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Your Aid Offer
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Description</p>
                    <p className="font-medium">{offer.description || "No description provided"}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-muted-foreground">Your Location</p>
                      <p className="font-medium" data-testid={`text-offer-location-${offer.id}`}>{offer.location}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant="outline" className="capitalize">
                      {offer.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              {offer.status === "available" && (
                <Button
                  onClick={() => setShowCommitDialog(true)}
                  disabled={isCommitting}
                  data-testid={`button-commit-${offer.id}-${request.id}`}
                >
                  {isCommitting ? "Committing..." : "Approve & Commit"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              {offer.status === "committed" && offer.matchedRequestId === request.id && (
                <Button
                  onClick={() => setShowDeliverDialog(true)}
                  disabled={isDelivering}
                  variant="default"
                  data-testid={`button-deliver-${offer.id}`}
                >
                  {isDelivering ? "Marking..." : "Mark as Delivered"}
                  <CheckCircle2 className="ml-2 h-4 w-4" />
                </Button>
              )}
              {offer.status === "delivered" && (
                <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Delivered
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve & Commit to This Request?</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to commit your aid offer to this help request. This means you're confirming that you will provide{" "}
              <strong>{offer.quantity} units of {offer.resourceType}</strong> to help fulfill this need.
              <br /><br />
              After committing, you'll be able to coordinate directly with the requester and mark the aid as delivered once completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCommit} data-testid="button-confirm-commit">
              Approve & Commit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeliverDialog} onOpenChange={setShowDeliverDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Delivered?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you've successfully delivered this aid? This action will mark both your offer and the help request as fulfilled.
              <br /><br />
              The person who requested help will be notified that their request has been fulfilled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not Yet</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeliver} data-testid="button-confirm-deliver">
              Confirm Delivery
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function AidMatchingDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const { data: myOffers = [], isLoading: isLoadingOffers } = useQuery<AidOffer[]>({
    queryKey: ["/api/aid-offers/mine"],
  });

  const canManageAid = user?.role && ["volunteer", "ngo", "admin"].includes(user.role);

  const { data: allRequests = [], isLoading: isLoadingRequests } = useQuery<ResourceRequest[]>({
    queryKey: ["/api/resource-requests"],
    enabled: canManageAid,
  });

  const commitMutation = useMutation({
    mutationFn: async ({ offerId, requestId }: { offerId: string; requestId: string }) => {
      return apiRequest("POST", `/api/aid-offers/${offerId}/commit`, { requestId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aid-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/aid-offers/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/resource-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/resource-requests/mine"] });
      toast({
        title: "Commitment Approved",
        description: "You've successfully committed to this help request. You can now coordinate delivery.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Commitment Failed",
        description: error.message || "Failed to commit to request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deliverMutation = useMutation({
    mutationFn: async (offerId: string) => {
      return apiRequest("POST", `/api/aid-offers/${offerId}/deliver`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aid-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/aid-offers/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/resource-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/resource-requests/mine"] });
      toast({
        title: "Aid Delivered",
        description: "The aid has been marked as delivered. Great work helping those in need!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delivery Update Failed",
        description: error.message || "Failed to mark as delivered. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCommit = (offerId: string, requestId: string) => {
    commitMutation.mutate({ offerId, requestId });
  };

  const handleDeliver = (offerId: string) => {
    deliverMutation.mutate(offerId);
  };

  const availableOffers = myOffers.filter(o => o.status === "available");
  const committedOffers = myOffers.filter(o => o.status === "committed");
  const deliveredOffers = myOffers.filter(o => o.status === "delivered");

  const pendingMatches = availableOffers.flatMap(offer => {
    const matchingRequests = allRequests.filter(
      request => 
        request.resourceType === offer.resourceType &&
        request.status === "pending" &&
        request.quantity <= offer.quantity
    );
    return matchingRequests.map(request => ({ offer, request }));
  });

  const activeCommitments = committedOffers.flatMap(offer => {
    if (offer.matchedRequestId) {
      const request = allRequests.find(r => r.id === offer.matchedRequestId);
      if (request) {
        return [{ offer, request }];
      }
    }
    return [];
  });

  const completedDeliveries = deliveredOffers.flatMap(offer => {
    if (offer.matchedRequestId) {
      const request = allRequests.find(r => r.id === offer.matchedRequestId);
      if (request) {
        return [{ offer, request }];
      }
    }
    return [];
  });

  if (!canManageAid) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            This page is only available to volunteers, NGOs, and administrators.
            Please update your role in the settings to access aid matching features.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoadingOffers || isLoadingRequests) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <Skeleton className="h-12 w-64 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Aid Matching Dashboard</h1>
          <p className="text-muted-foreground">
            Approve and manage matches between your aid offers and help requests
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/aid-offers")} data-testid="button-view-offers">
            View My Offers
          </Button>
          <Button onClick={() => navigate("/submit-aid-offer")} data-testid="button-create-offer">
            <Plus className="mr-2 h-4 w-4" />
            Offer Aid
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="pending" data-testid="tab-pending-matches">
            Pending Approval ({pendingMatches.length})
          </TabsTrigger>
          <TabsTrigger value="committed" data-testid="tab-active-commitments">
            Active Commitments ({activeCommitments.length})
          </TabsTrigger>
          <TabsTrigger value="delivered" data-testid="tab-completed">
            Completed ({completedDeliveries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingMatches.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No Pending Matches</p>
                <p className="text-muted-foreground text-center mb-4 max-w-md">
                  {availableOffers.length === 0
                    ? "Create an aid offer to start helping people in need"
                    : "There are no help requests matching your available aid offers right now"}
                </p>
                {availableOffers.length === 0 && (
                  <Button onClick={() => navigate("/submit-aid-offer")} data-testid="button-submit-first-offer">
                    Submit Your First Offer
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingMatches.map(({ offer, request }) => (
                <MatchCard
                  key={`${offer.id}-${request.id}`}
                  offer={offer}
                  request={request}
                  onCommit={handleCommit}
                  onDeliver={handleDeliver}
                  isCommitting={commitMutation.isPending}
                  isDelivering={deliverMutation.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="committed" className="space-y-4">
          {activeCommitments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No Active Commitments</p>
                <p className="text-muted-foreground text-center max-w-md">
                  Once you approve a match, it will appear here for delivery tracking
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeCommitments.map(({ offer, request }) => (
                <MatchCard
                  key={`${offer.id}-${request.id}`}
                  offer={offer}
                  request={request}
                  onCommit={handleCommit}
                  onDeliver={handleDeliver}
                  isCommitting={commitMutation.isPending}
                  isDelivering={deliverMutation.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="delivered" className="space-y-4">
          {completedDeliveries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No Completed Deliveries Yet</p>
                <p className="text-muted-foreground text-center max-w-md">
                  Your delivered aid will be tracked here for your records
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {completedDeliveries.map(({ offer, request }) => (
                <MatchCard
                  key={`${offer.id}-${request.id}`}
                  offer={offer}
                  request={request}
                  onCommit={handleCommit}
                  onDeliver={handleDeliver}
                  isCommitting={commitMutation.isPending}
                  isDelivering={deliverMutation.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
