import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Package, Droplet, Home, Plus, Shirt, HelpCircle, AlertCircle, Clock, CheckCircle2, XCircle, Wind, ArrowRight, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ResourceRequest } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Progress } from "@/components/ui/progress";
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

const urgencyColors = {
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusIcons = {
  pending: Clock,
  in_progress: AlertCircle,
  fulfilled: CheckCircle2,
  cancelled: XCircle,
};

const statusColors = {
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  fulfilled: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function ResourceRequestCard({ request, onFulfill, isFulfilling }: { 
  request: ResourceRequest; 
  onFulfill?: (id: string) => void;
  isFulfilling?: boolean;
}) {
  const ResourceIcon = resourceIcons[request.resourceType];
  const StatusIcon = statusIcons[request.status];

  const getProgressValue = () => {
    if (request.status === "fulfilled") return 100;
    if (request.status === "in_progress") return 66;
    if (request.status === "pending") return 33;
    return 0;
  };

  const getWorkflowStage = () => {
    if (request.status === "fulfilled") return "Delivered";
    if (request.status === "in_progress") return "Approved & In Transit";
    if (request.status === "pending") return "Waiting for Approval";
    return "Cancelled";
  };

  return (
    <Card className="hover-elevate" data-testid={`card-resource-request-${request.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <ResourceIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg mb-1 capitalize">
                {request.resourceType}
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {request.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Badge className={urgencyColors[request.urgency]} data-testid={`badge-urgency-${request.id}`}>
              {request.urgency}
            </Badge>
            <Badge className={statusColors[request.status]} data-testid={`badge-status-${request.id}`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {request.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {request.status !== "cancelled" && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg" data-testid={`workflow-status-${request.id}`}>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">Aid Workflow Status</span>
                <span className="text-muted-foreground">{getWorkflowStage()}</span>
              </div>
              <Progress value={getProgressValue()} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Request</span>
                <ArrowRight className="h-3 w-3" />
                <span>Approval</span>
                <ArrowRight className="h-3 w-3" />
                <span>Delivery</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Quantity</p>
              <p className="font-medium" data-testid={`text-quantity-${request.id}`}>{request.quantity} units</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Location</p>
              <p className="font-medium truncate" data-testid={`text-location-${request.id}`}>{request.location}</p>
            </div>
          </div>

          {request.contactInfo && (
            <div className="text-sm">
              <p className="text-muted-foreground mb-1">Contact</p>
              <p className="font-medium" data-testid={`text-contact-${request.id}`}>{request.contactInfo}</p>
            </div>
          )}

          {request.status === "in_progress" && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                A volunteer has committed to fulfill this request
              </p>
            </div>
          )}

          {request.status === "fulfilled" && request.fulfilledBy && request.fulfilledAt && (
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="text-sm text-green-900 dark:text-green-100">
                <p className="font-medium">Aid Delivered!</p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Fulfilled {formatDistanceToNow(new Date(request.fulfilledAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              Requested {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
            </p>
            {onFulfill && request.status === "pending" && (
              <Button
                size="sm"
                onClick={() => onFulfill(request.id)}
                disabled={isFulfilling}
                data-testid={`button-fulfill-${request.id}`}
              >
                {isFulfilling ? "Fulfilling..." : "Mark as Fulfilled"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ResourceRequests() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // WebSocket for real-time updates
  useWebSocket({
    onMessage: (message) => {
      if (message.type === "new_resource_request") {
        queryClient.invalidateQueries({ queryKey: ["/api/resource-requests"] });
        toast({
          title: "New Resource Request",
          description: "A new resource request has been submitted.",
        });
      } else if (message.type === "resource_request_updated") {
        queryClient.invalidateQueries({ queryKey: ["/api/resource-requests"] });
      } else if (message.type === "resource_request_fulfilled") {
        queryClient.invalidateQueries({ queryKey: ["/api/resource-requests"] });
        toast({
          title: "Request Fulfilled",
          description: "A resource request has been fulfilled.",
        });
      }
    },
  });

  const { data: allRequests = [], isLoading: isLoadingAll } = useQuery<ResourceRequest[]>({
    queryKey: ["/api/resource-requests"],
  });

  const { data: myRequests = [], isLoading: isLoadingMine } = useQuery<ResourceRequest[]>({
    queryKey: ["/api/resource-requests/mine"],
  });

  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
  });

  const canFulfill = user?.role && ["volunteer", "ngo", "admin"].includes(user.role);

  const fulfillMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/resource-requests/${requestId}/fulfill`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resource-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/resource-requests/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/aid-offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/aid-offers/mine"] });
      toast({
        title: "Request Fulfilled",
        description: "Resource request marked as fulfilled successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Action Failed",
        description: error.message || "Failed to fulfill request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFulfill = (requestId: string) => {
    fulfillMutation.mutate(requestId);
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Resource Requests</h1>
            <p className="text-muted-foreground">
              View and manage resource requests from people in need
            </p>
          </div>
          <Button onClick={() => navigate("/submit-resource-request")} data-testid="button-submit-request">
            Submit Request
          </Button>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all" data-testid="tab-all-requests">
              All Requests ({allRequests.length})
            </TabsTrigger>
            <TabsTrigger value="mine" data-testid="tab-my-requests">
              My Requests ({myRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {isLoadingAll ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : allRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No resource requests yet</p>
                  <p className="text-muted-foreground text-center mb-4">
                    Be the first to submit a resource request
                  </p>
                  <Button onClick={() => navigate("/submit-resource-request")} data-testid="button-submit-first-request">
                    Submit Request
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allRequests.map((request) => (
                  <ResourceRequestCard
                    key={request.id}
                    request={request}
                    onFulfill={canFulfill ? handleFulfill : undefined}
                    isFulfilling={fulfillMutation.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine" className="space-y-4">
            {isLoadingMine ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : myRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No resource requests yet</p>
                  <p className="text-muted-foreground text-center mb-4">
                    You haven't submitted any resource requests
                  </p>
                  <Button onClick={() => navigate("/submit-resource-request")} data-testid="button-submit-my-first-request">
                    Submit Request
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myRequests.map((request) => (
                  <ResourceRequestCard
                    key={request.id}
                    request={request}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
