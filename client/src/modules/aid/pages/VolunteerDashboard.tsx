import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Package,
  Heart,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Users,
  Droplet,
  Home,
  Plus,
  Shirt,
  Wind,
  HelpCircle,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ResourceRequest, AidOffer, DisasterReport } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

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

const severityColors = {
  low: "bg-blue-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  color = "primary",
}: {
  title: string;
  value: number | string;
  description: string;
  icon: any;
  trend?: string;
  color?: string;
}) {
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 text-${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`stat-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
        {trend && (
          <div className="flex items-center mt-2 text-xs text-green-600 dark:text-green-400">
            <TrendingUp className="h-3 w-3 mr-1" />
            {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResourceRequestPreview({ request, onView }: { request: ResourceRequest; onView: () => void }) {
  const ResourceIcon = resourceIcons[request.resourceType];
  
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors" data-testid={`preview-request-${request.id}`}>
      <div className="flex items-center gap-3 flex-1">
        <div className="p-2 rounded-lg bg-primary/10">
          <ResourceIcon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium capitalize truncate">{request.resourceType}</p>
            <Badge className={urgencyColors[request.urgency as keyof typeof urgencyColors]} data-testid={`badge-urgency-${request.id}`}>
              {request.urgency}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {request.quantity} units
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {request.location.substring(0, 20)}...
            </span>
          </div>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onView} data-testid={`button-view-request-${request.id}`}>
        View
      </Button>
    </div>
  );
}

function AidOfferPreview({ offer, onView }: { offer: AidOffer; onView: () => void }) {
  const ResourceIcon = resourceIcons[offer.resourceType];
  
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors" data-testid={`preview-offer-${offer.id}`}>
      <div className="flex items-center gap-3 flex-1">
        <div className="p-2 rounded-lg bg-green-500/10">
          <ResourceIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium capitalize truncate">{offer.resourceType}</p>
            <Badge variant="secondary" className="text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-200" data-testid={`badge-status-${offer.id}`}>
              {offer.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {offer.quantity} units
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {offer.location.substring(0, 20)}...
            </span>
          </div>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onView} data-testid={`button-view-offer-${offer.id}`}>
        Matches
      </Button>
    </div>
  );
}

function ReportToVerify({ report, onView }: { report: DisasterReport; onView: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors" data-testid={`preview-report-${report.id}`}>
      <div className="flex items-center gap-3 flex-1">
        <div className={`w-2 h-2 rounded-full ${severityColors[report.severity]}`} />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{report.title}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="capitalize">{report.type}</span>
            <span>{formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}</span>
          </div>
        </div>
        {report.aiValidationScore && (
          <Badge variant="outline" className="text-xs">
            AI: {report.aiValidationScore}%
          </Badge>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={onView} data-testid={`button-verify-report-${report.id}`}>
        Verify
      </Button>
    </div>
  );
}

export default function VolunteerDashboard() {
  const [, navigate] = useLocation();

  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const { data: allRequests = [], isLoading: isLoadingRequests } = useQuery<ResourceRequest[]>({
    queryKey: ["/api/resource-requests"],
  });

  const { data: allOffers = [], isLoading: isLoadingOffers } = useQuery<AidOffer[]>({
    queryKey: ["/api/aid-offers"],
  });

  const { data: myOffers = [] } = useQuery<AidOffer[]>({
    queryKey: ["/api/aid-offers/mine"],
  });

  const { data: reportsResponse, isLoading: isLoadingReports } = useQuery<{ data: DisasterReport[]; pagination: any }>({
    queryKey: ["/api/reports"],
  });
  
  const reports = reportsResponse?.data || [];

  const isVolunteerOrNGO = user?.role && ["volunteer", "ngo", "admin"].includes(user.role);

  const pendingRequests = allRequests.filter(r => r.status === "pending");
  const inProgressRequests = allRequests.filter(r => r.status === "in_progress");
  const fulfilledRequests = allRequests.filter(r => r.status === "fulfilled");
  const availableOffers = allOffers.filter(o => o.status === "available");
  const committedOffers = allOffers.filter(o => o.status === "committed");

  const criticalRequests = pendingRequests.filter(r => r.urgency === "critical");
  const highPriorityRequests = pendingRequests.filter(r => r.urgency === "high");

  const unconfirmedReports = reports.filter(
    r => !r.confirmedBy && r.status === "reported" && r.verificationCount >= 3
  );

  const demandSupplyRatio = availableOffers.length > 0 
    ? Math.round((pendingRequests.length / availableOffers.length) * 100) 
    : pendingRequests.length > 0 ? 100 : 0;

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">Volunteer Dashboard</h1>
            </div>
            <p className="text-muted-foreground">
              Coordinate resources and respond to disaster needs in your community
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Pending Requests"
            value={pendingRequests.length}
            description={`${criticalRequests.length} critical, ${highPriorityRequests.length} high priority`}
            icon={AlertTriangle}
            color="orange-500"
          />
          <StatCard
            title="Available Resources"
            value={availableOffers.length}
            description={`${committedOffers.length} already committed`}
            icon={Heart}
            color="green-500"
          />
          <StatCard
            title="Fulfillment Rate"
            value={`${allRequests.length > 0 ? Math.round((fulfilledRequests.length / allRequests.length) * 100) : 0}%`}
            description={`${fulfilledRequests.length} of ${allRequests.length} fulfilled`}
            icon={CheckCircle2}
            color="blue-500"
            trend={fulfilledRequests.length > 0 ? `${fulfilledRequests.length} completed` : undefined}
          />
          <StatCard
            title="Needs Verification"
            value={unconfirmedReports.length}
            description="Reports with 3+ verifications"
            icon={AlertTriangle}
            color="yellow-500"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Demand-Supply Overview
            </CardTitle>
            <CardDescription>
              Real-time resource availability vs. demand ratio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Demand vs Supply</span>
                  <span className="text-sm text-muted-foreground">
                    {pendingRequests.length} requests / {availableOffers.length} offers
                  </span>
                </div>
                <Progress value={Math.min(demandSupplyRatio, 100)} className="h-3" />
                <p className="text-xs text-muted-foreground mt-2">
                  {demandSupplyRatio > 80 && "⚠️ High demand - more resources needed"}
                  {demandSupplyRatio > 40 && demandSupplyRatio <= 80 && "⚖️ Moderate demand - balanced"}
                  {demandSupplyRatio <= 40 && availableOffers.length > 0 && "✅ Good supply availability"}
                  {availableOffers.length === 0 && pendingRequests.length === 0 && "✨ No active requests"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">In Progress</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{inProgressRequests.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">My Offers</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{myOffers.length}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="requests" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="requests" data-testid="tab-requests">
              Pending Requests ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="offers" data-testid="tab-offers">
              My Offers ({myOffers.length})
            </TabsTrigger>
            <TabsTrigger value="verification" data-testid="tab-verification">
              Needs Verification ({unconfirmedReports.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Resource Requests Needing Help</CardTitle>
                    <CardDescription>
                      Respond to urgent requests from disaster victims
                    </CardDescription>
                  </div>
                  <Button onClick={() => navigate("/resource-requests")} data-testid="button-view-all-requests">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingRequests ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                  </div>
                ) : pendingRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">No pending requests</p>
                    <p className="text-sm text-muted-foreground">All resource requests have been addressed</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.slice(0, 5).map(request => (
                      <ResourceRequestPreview
                        key={request.id}
                        request={request}
                        onView={() => navigate("/resource-requests")}
                      />
                    ))}
                    {pendingRequests.length > 5 && (
                      <Button 
                        variant="ghost" 
                        className="w-full" 
                        onClick={() => navigate("/resource-requests")}
                        data-testid="button-see-more-requests"
                      >
                        See {pendingRequests.length - 5} more requests
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="offers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Your Aid Offers</CardTitle>
                    <CardDescription>
                      Resources you've offered to help victims
                    </CardDescription>
                  </div>
                  <Button onClick={() => navigate("/submit-aid-offer")} data-testid="button-create-offer">
                    <Plus className="mr-2 h-4 w-4" />
                    New Offer
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingOffers ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                  </div>
                ) : myOffers.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-lg font-medium text-muted-foreground mb-2">No aid offers yet</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Share resources you can provide to help disaster victims
                    </p>
                    <Button onClick={() => navigate("/submit-aid-offer")} data-testid="button-create-first-offer">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Offer
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myOffers.map(offer => (
                      <AidOfferPreview
                        key={offer.id}
                        offer={offer}
                        onView={() => navigate(`/aid-offers/${offer.id}/matches`)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verification" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Reports Needing Official Confirmation</CardTitle>
                    <CardDescription>
                      {isVolunteerOrNGO 
                        ? "Verify and confirm disaster reports with 3+ community verifications"
                        : "Only volunteers, NGOs, and admins can confirm reports"}
                    </CardDescription>
                  </div>
                  <Button onClick={() => navigate("/reports")} data-testid="button-view-all-reports">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingReports ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : !isVolunteerOrNGO ? (
                  <div className="text-center py-12">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-lg font-medium text-muted-foreground mb-2">Access Restricted</p>
                    <p className="text-sm text-muted-foreground">
                      Only volunteers, NGOs, and admins can confirm disaster reports
                    </p>
                  </div>
                ) : unconfirmedReports.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">No reports need confirmation</p>
                    <p className="text-sm text-muted-foreground">All verified reports have been confirmed</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unconfirmedReports.slice(0, 5).map(report => (
                      <ReportToVerify
                        key={report.id}
                        report={report}
                        onView={() => navigate("/reports")}
                      />
                    ))}
                    {unconfirmedReports.length > 5 && (
                      <Button 
                        variant="ghost" 
                        className="w-full" 
                        onClick={() => navigate("/reports")}
                        data-testid="button-see-more-reports"
                      >
                        See {unconfirmedReports.length - 5} more reports
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                AI-Powered Matching
              </CardTitle>
              <CardDescription>
                Let AI help you find the best requests for your resources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Our AI analyzes location, quantity, urgency, and other factors to match your aid offers with the most suitable requests.
              </p>
              <Button onClick={() => navigate("/aid-offers")} className="w-full" data-testid="button-explore-matching">
                <Sparkles className="mr-2 h-4 w-4" />
                Explore Matches
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-green-600 dark:text-green-400" />
                Make an Impact
              </CardTitle>
              <CardDescription>
                Every action helps save lives and rebuild communities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {fulfilledRequests.length > 0 
                  ? `You've collectively helped fulfill ${fulfilledRequests.length} requests! Keep up the amazing work.`
                  : "Start making a difference by responding to resource requests or offering aid."}
              </p>
              <Button 
                onClick={() => navigate("/resource-requests")} 
                className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                data-testid="button-help-now"
              >
                <Heart className="mr-2 h-4 w-4" />
                Help Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
