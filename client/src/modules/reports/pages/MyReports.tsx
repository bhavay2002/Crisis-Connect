import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DisasterReportCard from "@/components/feed/DisasterReportCard";
import { AlertTriangle, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { DisasterReport } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function MyReports() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: reportsResponse, isLoading } = useQuery<{ data: DisasterReport[]; pagination: any }>({
    queryKey: ["/api/reports/user", user?.id],
    enabled: !!user?.id,
  });

  const reports = reportsResponse?.data || [];

  const handleVerify = async (reportId: string) => {
    try {
      await apiRequest(`/api/reports/${reportId}/verify`, { method: "POST" });
      toast({
        title: "Report verified",
        description: "Thank you for helping verify this report",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/user", user?.id] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to verify report",
        variant: "destructive",
      });
    }
  };

  const filteredReports = reports.filter((report) => {
    const matchesSearch = !searchQuery || 
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  if (!user) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Please sign in to view your reports</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <FileText className="h-8 w-8" />
                My Reports
              </h1>
              <p className="text-muted-foreground mt-2">
                View and manage all your submitted disaster reports
              </p>
            </div>
            <Button onClick={() => setLocation("/submit")} data-testid="button-submit-new-report">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Submit New Report
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Search your reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-reports"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading your reports...</p>
            </div>
          </div>
        ) : filteredReports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                {reports.length === 0 ? "No Reports Yet" : "No Matching Reports"}
              </p>
              <p className="text-muted-foreground text-center mb-4 max-w-md">
                {reports.length === 0
                  ? "You haven't submitted any disaster reports yet. Help your community by reporting emergencies."
                  : "No reports match your search criteria. Try different keywords."}
              </p>
              {reports.length === 0 && (
                <Button onClick={() => setLocation("/submit")} data-testid="button-submit-first-report">
                  Submit Your First Report
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredReports.map((report) => (
              <DisasterReportCard
                key={report.id}
                report={{ ...report, timestamp: report.createdAt.toISOString() }}
                onVerify={() => handleVerify(report.id)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
