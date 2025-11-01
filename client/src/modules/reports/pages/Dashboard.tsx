import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StatsCard from "@/components/feed/StatsCard";
import DisasterReportCard from "@/components/feed/DisasterReportCard";
import AlertBanner from "@/components/layout/AlertBanner";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, Users, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { DisasterReport } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Dashboard() {
  const [showAlert, setShowAlert] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all disaster reports
  const { data: reports = [], isLoading } = useQuery<DisasterReport[]>({
    queryKey: ["/api/reports"],
  });

  // WebSocket for real-time updates
  useWebSocket({
    onMessage: useCallback((message: any) => {
      if (message.type === "new_report" || message.type === "report_updated" || message.type === "report_verified") {
        // Invalidate the reports query to refresh the data
        queryClient.invalidateQueries({ queryKey: ["/api/reports"] });

        // Show toast notification
        if (message.type === "new_report") {
          toast({
            title: "New Emergency Report",
            description: message.data?.title || "A new disaster has been reported",
          });
        }
      }
    }, [queryClient, toast]),
  });

  const handleVerify = async (reportId: string) => {
    try {
      await apiRequest("POST", `/api/reports/${reportId}/verify`);
      toast({
        title: "Report verified",
        description: "Thank you for helping verify this report",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
    } catch (error: any) {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to verify report",
        variant: "destructive",
      });
    }
  };

  // Calculate stats from reports
  const stats = {
    activeReports: reports.filter(r => r.status !== "resolved").length,
    verifiedIncidents: reports.filter(r => r.status === "verified" || r.status === "responding").length,
    responseTeams: reports.filter(r => r.status === "responding").length,
    affectedAreas: new Set(reports.map(r => r.location)).size,
  };

  // Get critical reports for alert
  const criticalReports = reports.filter(r => r.severity === "critical" && r.status !== "resolved");

  // Filter reports for display (show most recent 6)
  const recentReports = reports
    .filter(r => r.status !== "resolved")
    .slice(0, 6);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Critical Alert */}
        {showAlert && criticalReports.length > 0 && (
          <AlertBanner
            type="critical"
            title="Active Emergency Alert"
            message={`${criticalReports.length} critical incident${criticalReports.length > 1 ? 's' : ''} requiring immediate attention. ${criticalReports[0]?.title}`}
            onDismiss={() => setShowAlert(false)}
            action={{
              label: "View Details",
              onClick: () => console.log("View emergency details"),
            }}
          />
        )}

        {/* Page Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Emergency Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time overview of active incidents and emergency response status
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Active Reports"
            value={stats.activeReports}
            icon={AlertTriangle}
            description="Pending verification"
          />
          <StatsCard
            title="Verified Incidents"
            value={stats.verifiedIncidents}
            icon={CheckCircle}
            description="Confirmed emergencies"
          />
          <StatsCard
            title="Response Teams"
            value={stats.responseTeams}
            icon={Users}
            description="Currently deployed"
          />
          <StatsCard
            title="Affected Areas"
            value={stats.affectedAreas}
            icon={MapPinned}
            description="Locations with active incidents"
          />
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search reports by location, type, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-reports"
            />
          </div>
          <Button variant="outline" data-testid="button-filter">
            Filter
          </Button>
        </div>

        {/* Active Reports */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Active Reports</h2>
            <Button variant="outline" size="sm" data-testid="button-view-all">
              View All
            </Button>
          </div>
          {recentReports.length === 0 ? (
            <div className="text-center py-12 bg-muted rounded-lg">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground font-medium">
                No active reports - Stay safe!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {recentReports.map((report) => (
                <DisasterReportCard
                  key={report.id}
                  report={{
                    id: report.id,
                    title: report.title,
                    type: report.type,
                    severity: report.severity,
                    location: report.location,
                    description: report.description,
                    timestamp: new Date(report.createdAt).toLocaleString(),
                    verificationCount: report.verificationCount,
                    status: report.status,
                  }}
                  onVerify={() => handleVerify(report.id)}
                  onViewDetails={() => console.log(`View details ${report.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Map Section Placeholder */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Incident Map</h2>
          <div className="h-96 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
            <div className="text-center">
              <MapPinned className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground font-medium">
                Interactive map showing all active incidents
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Map integration will display locations, severity levels, and real-time updates
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
