import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { DisasterReport } from "@shared/schema";
import {
  MapPin,
  Clock,
  ThumbsUp,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Droplets,
  ArrowLeft,
  Image as ImageIcon,
} from "lucide-react";
import { FakeDetectionBadge } from "@/components/FakeDetectionBadge";
import { formatDistanceToNow, format } from "date-fns";

const typeIcons = {
  fire: Flame,
  flood: Droplets,
  earthquake: AlertTriangle,
  storm: AlertTriangle,
  road_accident: AlertTriangle,
  epidemic: AlertTriangle,
  landslide: AlertTriangle,
  gas_leak: AlertTriangle,
  building_collapse: AlertTriangle,
  chemical_spill: AlertTriangle,
  power_outage: AlertTriangle,
  water_contamination: Droplets,
  other: AlertTriangle,
};

const severityColors = {
  low: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};

const statusColors = {
  reported: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
  verified: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  responding: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  resolved: "bg-green-500/10 text-green-700 dark:text-green-400",
};

export default function ReportDetails() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/reports/:id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reportId = params?.id;

  const { data: report, isLoading } = useQuery<DisasterReport>({
    queryKey: [`/api/reports/${reportId}`],
    enabled: !!reportId,
  });

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const { data: userVerifications = [] } = useQuery<{ reportId: string }[]>({
    queryKey: ["/api/verifications/mine"],
    enabled: !!currentUser,
  });

  const hasVerified = userVerifications.some(v => v.reportId === reportId);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/reports/${reportId}/verify`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/reports/${reportId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/verifications/mine"] });
      toast({
        title: "Report upvoted",
        description: "Thank you for helping verify this report",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => navigate("/login"), 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to upvote report",
        variant: "destructive",
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const isConfirmed = !!report?.confirmedBy;
      if (isConfirmed) {
        return apiRequest(`/api/reports/${reportId}/confirm`, { method: "DELETE" });
      } else {
        return apiRequest(`/api/reports/${reportId}/confirm`, { method: "POST" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/reports/${reportId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      const isConfirmed = !!report?.confirmedBy;
      toast({
        title: isConfirmed ? "Confirmation removed" : "Report confirmed",
        description: isConfirmed
          ? "Report confirmation has been removed"
          : "You have officially confirmed this report",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => navigate("/login"), 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to confirm report",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading report details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!report) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-4 md:p-6 max-w-4xl">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Report not found</p>
              <p className="text-muted-foreground text-center mb-4">
                This report may have been deleted or you don't have permission to view it
              </p>
              <Button onClick={() => navigate("/reports")} data-testid="button-back-to-reports">
                Back to Reports
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const TypeIcon = typeIcons[report.type];
  const isConfirmed = !!report.confirmedBy;
  const canConfirm = currentUser && ["volunteer", "ngo", "admin"].includes(currentUser.role);

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/reports")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Reports
        </Button>

        <Card className={`border-l-4 ${report.severity === "critical" ? "border-l-destructive" : report.severity === "high" ? "border-l-orange-500" : report.severity === "medium" ? "border-l-yellow-500" : "border-l-blue-500"}`}>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className={`p-3 rounded-md ${severityColors[report.severity]}`}>
                <TypeIcon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2" data-testid="text-report-title">
                  {report.title}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className={statusColors[report.status]} data-testid="badge-status">
                    {report.status.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-xs uppercase font-semibold">
                    {report.severity}
                  </Badge>
                  {isConfirmed && (
                    <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs" data-testid="badge-confirmed">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      CONFIRMED
                    </Badge>
                  )}
                  <FakeDetectionBadge
                    score={report.fakeDetectionScore}
                    flags={report.fakeDetectionFlags}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground" data-testid="text-description">
                {report.description}
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium" data-testid="text-location">{report.location}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Reported</p>
                    <p className="font-medium" data-testid="text-created-at">
                      {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(report.createdAt), "PPpp")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Upvotes</p>
                    <p className="font-medium" data-testid="text-verification-count">
                      {report.verificationCount} upvotes
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {report.mediaUrls && report.mediaUrls.length > 0 && (
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Media</p>
                      <div className="flex flex-col gap-1">
                        {report.mediaUrls.map((url, index) => (
                          <a
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm"
                            data-testid={`link-media-${index}`}
                          >
                            View media {index + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isConfirmed && report.confirmedAt && (
              <>
                <Separator />
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold text-green-900 dark:text-green-100">
                      Officially Confirmed
                    </h3>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Confirmed {formatDistanceToNow(new Date(report.confirmedAt), { addSuffix: true })}
                  </p>
                </div>
              </>
            )}

            <Separator />

            <div className="flex gap-2 flex-wrap">
              <Button
                variant={hasVerified ? "default" : "outline"}
                onClick={() => verifyMutation.mutate()}
                disabled={hasVerified || verifyMutation.isPending}
                data-testid="button-upvote"
              >
                <ThumbsUp className="w-4 h-4 mr-2" />
                {hasVerified ? "Upvoted" : verifyMutation.isPending ? "Upvoting..." : "Upvote"}
              </Button>

              {canConfirm && (
                <Button
                  variant={isConfirmed ? "default" : "outline"}
                  onClick={() => confirmMutation.mutate()}
                  disabled={confirmMutation.isPending}
                  className={isConfirmed ? "bg-green-600 hover:bg-green-700" : ""}
                  data-testid="button-confirm"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {confirmMutation.isPending
                    ? "Processing..."
                    : isConfirmed
                      ? "Confirmed"
                      : "Confirm"}
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => navigate("/map")}
                data-testid="button-view-on-map"
              >
                <MapPin className="w-4 h-4 mr-2" />
                View on Map
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
