import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Package, Droplet, Home, Plus, Shirt, HelpCircle, AlertCircle, Clock, CheckCircle2, XCircle, Wind, Heart, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AidOffer } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useWebSocket } from "@/hooks/useWebSocket";
import DashboardLayout from "@/components/layout/DashboardLayout";

const resourceIcons = {
  food: Package,
  water: Droplet,
  shelter: Home,
  medical: Plus,
  clothing: Shirt,
  blankets: Wind,
  other: HelpCircle,
};

const statusIcons = {
  available: Clock,
  committed: AlertCircle,
  delivered: CheckCircle2,
  cancelled: XCircle,
};

const statusColors = {
  available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  committed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  delivered: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function AidOfferCard({ offer, isOwner, onViewMatches }: { 
  offer: AidOffer; 
  isOwner?: boolean;
  onViewMatches?: (id: string) => void;
}) {
  const ResourceIcon = resourceIcons[offer.resourceType];
  const StatusIcon = statusIcons[offer.status];

  return (
    <Card className="hover-elevate" data-testid={`card-aid-offer-${offer.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <ResourceIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg mb-1 capitalize">
                {offer.resourceType}
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {offer.description}
              </CardDescription>
            </div>
          </div>
          <Badge className={statusColors[offer.status]} data-testid={`badge-status-${offer.id}`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {offer.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Quantity</p>
              <p className="font-medium" data-testid={`text-quantity-${offer.id}`}>{offer.quantity} units</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Location</p>
              <p className="font-medium truncate" data-testid={`text-location-${offer.id}`}>{offer.location}</p>
            </div>
          </div>

          {offer.contactInfo && (
            <div className="text-sm">
              <p className="text-muted-foreground mb-1">Contact</p>
              <p className="font-medium" data-testid={`text-contact-${offer.id}`}>{offer.contactInfo}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              Offered {formatDistanceToNow(new Date(offer.createdAt), { addSuffix: true })}
            </p>
            {isOwner && offer.status === "available" && onViewMatches && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewMatches(offer.id)}
                data-testid={`button-view-matches-${offer.id}`}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                View Matches
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AidOffers() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useWebSocket({
    onMessage: (message) => {
      if (message.type === "new_aid_offer") {
        queryClient.invalidateQueries({ queryKey: ["/api/aid-offers"] });
        toast({
          title: "New Aid Offer",
          description: "A new aid offer has been submitted.",
        });
      } else if (message.type === "aid_offer_updated") {
        queryClient.invalidateQueries({ queryKey: ["/api/aid-offers"] });
      } else if (message.type === "aid_offer_delivered") {
        queryClient.invalidateQueries({ queryKey: ["/api/aid-offers"] });
        toast({
          title: "Aid Delivered",
          description: "An aid offer has been marked as delivered.",
        });
      }
    },
  });

  const { data: allOffers = [], isLoading: isLoadingAll } = useQuery<AidOffer[]>({
    queryKey: ["/api/aid-offers"],
  });

  const { data: myOffers = [], isLoading: isLoadingMine } = useQuery<AidOffer[]>({
    queryKey: ["/api/aid-offers/mine"],
  });

  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const canCreateOffer = user?.role && ["volunteer", "ngo", "admin"].includes(user.role);

  const handleViewMatches = (offerId: string) => {
    navigate(`/aid-offers/${offerId}/matches`);
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Heart className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Aid Offers</h1>
          </div>
          <p className="text-muted-foreground">
            Resources available from volunteers and NGOs to help disaster victims
          </p>
        </div>
        {canCreateOffer && (
          <Button onClick={() => navigate("/submit-aid-offer")} data-testid="button-create-offer">
            <Plus className="mr-2 h-4 w-4" />
            Offer Aid
          </Button>
        )}
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-offers">
            All Offers ({allOffers.length})
          </TabsTrigger>
          {canCreateOffer && (
            <TabsTrigger value="mine" data-testid="tab-my-offers">
              My Offers ({myOffers.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {isLoadingAll ? (
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
          ) : allOffers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Heart className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">No Aid Offers Available</p>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  {canCreateOffer 
                    ? "Be the first to offer aid! Click the button above to submit your offer."
                    : "Check back later for available aid offers from volunteers and NGOs."}
                </p>
              </CardContent>
            </Card>
          ) : (
            allOffers.map((offer) => (
              <AidOfferCard key={offer.id} offer={offer} />
            ))
          )}
        </TabsContent>

        {canCreateOffer && (
          <TabsContent value="mine" className="space-y-4">
            {isLoadingMine ? (
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
            ) : myOffers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Heart className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium text-muted-foreground mb-2">You haven't offered any aid yet</p>
                  <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                    Share resources you can provide to help disaster victims in need
                  </p>
                  <Button onClick={() => navigate("/submit-aid-offer")} data-testid="button-submit-first-offer">
                    <Plus className="mr-2 h-4 w-4" />
                    Submit Your First Offer
                  </Button>
                </CardContent>
              </Card>
            ) : (
              myOffers.map((offer) => (
                <AidOfferCard 
                  key={offer.id} 
                  offer={offer} 
                  isOwner={true}
                  onViewMatches={handleViewMatches}
                />
              ))
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
    </DashboardLayout>
  );
}
