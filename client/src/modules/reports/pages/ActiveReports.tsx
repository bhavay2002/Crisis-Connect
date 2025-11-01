import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DisasterReportCard from "@/components/feed/DisasterReportCard";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
import type { DisasterReport } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function ActiveReports() {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch current user
  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  // Fetch user's verifications
  const { data: userVerifications = [] } = useQuery<{ reportId: string }[]>({
    queryKey: ["/api/verifications/mine"],
    enabled: !!currentUser,
  });

  // Create a Set for quick lookup
  const verifiedReportIds = new Set(userVerifications.map(v => v.reportId));

  // Fetch all disaster reports
  const { data: reports = [], isLoading } = useQuery<DisasterReport[]>({
    queryKey: ["/api/reports"],
  });

  // WebSocket for real-time updates
  useWebSocket({
    onMessage: useCallback((message: any) => {
      if (message.type === "new_report" || message.type === "report_updated" || message.type === "report_verified" || message.type === "report_confirmed" || message.type === "report_unconfirmed") {
        queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
        queryClient.invalidateQueries({ queryKey: ["/api/verifications/mine"] });
      }
    }, [queryClient]),
  });

  const handleVerify = async (reportId: string) => {
    try {
      await apiRequest("POST", `/api/reports/${reportId}/verify`);
      toast({
        title: "Report upvoted",
        description: "Thank you for helping verify this report",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/verifications/mine"] });
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
        description: error.message || "Failed to upvote report",
        variant: "destructive",
      });
    }
  };

  const handleConfirm = async (reportId: string, isConfirmed: boolean) => {
    try {
      if (isConfirmed) {
        // Unconfirm the report
        await apiRequest("DELETE", `/api/reports/${reportId}/confirm`);
        toast({
          title: "Confirmation removed",
          description: "Report confirmation has been removed",
        });
      } else {
        // Confirm the report
        await apiRequest("POST", `/api/reports/${reportId}/confirm`);
        toast({
          title: "Report confirmed",
          description: "You have officially confirmed this report",
        });
      }
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
        description: error.message || "Failed to confirm report",
        variant: "destructive",
      });
    }
  };

  // Filter reports based on search and filters
  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      searchQuery === "" ||
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity =
      severityFilter === "all" || report.severity === severityFilter;

    const matchesStatus =
      statusFilter === "all" || report.status === statusFilter;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading reports...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Active Reports</h1>
          <p className="text-muted-foreground">
            View and manage all emergency incident reports
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search reports by location, type, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <div className="flex gap-2">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-40" data-testid="select-severity-filter">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="reported">Reported</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="responding">Responding</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" data-testid="button-advanced-filter">
              <Filter className="w-4 h-4 mr-2" />
              More Filters
            </Button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredReports.length} of {reports.length} reports
        </div>

        {/* Reports Grid */}
        {filteredReports.length === 0 ? (
          <div className="text-center py-12 bg-muted rounded-lg">
            <p className="text-muted-foreground font-medium">
              No reports match your filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredReports.map((report) => {
              const canConfirm = currentUser && ["volunteer", "ngo", "admin"].includes(currentUser.role);
              const isConfirmed = !!report.confirmedBy;
              const hasVerified = verifiedReportIds.has(report.id);
              
              return (
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
                    confirmedBy: report.confirmedBy,
                    confirmedAt: report.confirmedAt,
                  }}
                  onVerify={() => handleVerify(report.id)}
                  onConfirm={() => handleConfirm(report.id, isConfirmed)}
                  onViewDetails={() => console.log(`View details ${report.id}`)}
                  canConfirm={canConfirm}
                  userRole={currentUser?.role}
                  hasVerified={hasVerified}
                />
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
