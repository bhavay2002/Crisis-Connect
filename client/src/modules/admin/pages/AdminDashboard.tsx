import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import type { DisasterReport, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  CheckCircle, 
  Flag, 
  UserPlus, 
  Filter,
  Clock,
  MapPin,
  FileText,
  Shield,
  Users,
  TrendingUp
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<DisasterReport | null>(null);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [flagType, setFlagType] = useState<string>("false_report");
  const [adminNotes, setAdminNotes] = useState("");
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<string>("");

  // Check if user is admin or NGO
  const isAuthorized = user?.role === "admin" || user?.role === "ngo";
  const isAdmin = user?.role === "admin";

  // Fetch all reports
  const { data: allReportsResponse, isLoading } = useQuery<{ data: DisasterReport[]; pagination: any }>({
    queryKey: ["/api/reports"],
  });
  
  const allReports = allReportsResponse?.data || [];

  // Fetch prioritized reports
  const { data: prioritizedReports = [] } = useQuery<DisasterReport[]>({
    queryKey: ["/api/admin/reports/prioritized"],
    enabled: isAuthorized,
  });

  // Fetch flagged reports
  const { data: flaggedReports = [] } = useQuery<DisasterReport[]>({
    queryKey: ["/api/admin/reports/flagged"],
    enabled: isAuthorized,
  });

  // Fetch assignable users for assignment
  const { data: assignableUsers = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/assignable-users"],
    enabled: isAuthorized,
  });

  // Fetch all users for management (admin only)
  const { data: allUsers = [], isLoading: isLoadingAllUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin,
  });

  // Flag report mutation
  const flagReportMutation = useMutation({
    mutationFn: async ({ reportId, flagType, notes }: { reportId: string; flagType: string; notes?: string }) => {
      return await apiRequest("POST", `/api/admin/reports/${reportId}/flag`, {
        flagType,
        adminNotes: notes,
      });
    },
    onSuccess: () => {
      toast({
        title: "Report flagged",
        description: "The report has been flagged successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports/flagged"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports/prioritized"] });
      setFlagDialogOpen(false);
      setSelectedReport(null);
    },
    onError: (error: any) => {
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
        description: error.message || "Failed to flag report",
        variant: "destructive",
      });
    },
  });

  // Assign report mutation
  const assignReportMutation = useMutation({
    mutationFn: async ({ reportId, volunteerId }: { reportId: string; volunteerId: string }) => {
      return await apiRequest("POST", `/api/admin/reports/${reportId}/assign`, {
        volunteerId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Report assigned",
        description: "The report has been assigned successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports/prioritized"] });
      setAssignDialogOpen(false);
      setSelectedReport(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign report",
        variant: "destructive",
      });
    },
  });

  // Add notes mutation
  const addNotesMutation = useMutation({
    mutationFn: async ({ reportId, notes }: { reportId: string; notes: string }) => {
      return await apiRequest("PATCH", `/api/admin/reports/${reportId}/notes`, {
        notes,
      });
    },
    onSuccess: () => {
      toast({
        title: "Notes added",
        description: "Admin notes have been added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      setNotesDialogOpen(false);
      setSelectedReport(null);
      setAdminNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add notes",
        variant: "destructive",
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ reportId, status }: { reportId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/reports/${reportId}/status`, { status });
    },
    onSuccess: () => {
      toast({
        title: "Status updated",
        description: "Report status has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports/prioritized"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await apiRequest("POST", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      toast({
        title: "Role updated",
        description: "User role has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/assignable-users"] });
      setRoleDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
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
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  const handleFlagReport = () => {
    if (selectedReport) {
      flagReportMutation.mutate({
        reportId: selectedReport.id,
        flagType,
        notes: adminNotes,
      });
    }
  };

  const handleAssignReport = () => {
    if (selectedReport && selectedVolunteer) {
      assignReportMutation.mutate({
        reportId: selectedReport.id,
        volunteerId: selectedVolunteer,
      });
    }
  };

  const handleAddNotes = () => {
    if (selectedReport && adminNotes.trim()) {
      addNotesMutation.mutate({
        reportId: selectedReport.id,
        notes: adminNotes,
      });
    }
  };

  const handleUpdateUserRole = () => {
    if (selectedUser && newRole) {
      updateUserRoleMutation.mutate({
        userId: selectedUser.id,
        role: newRole,
      });
    }
  };

  // Filter reports based on active tab and status filter
  const getFilteredReports = () => {
    let reports = allReports;

    if (activeTab === "prioritized") {
      reports = prioritizedReports;
    } else if (activeTab === "flagged") {
      reports = flaggedReports;
    }

    if (statusFilter !== "all") {
      reports = reports.filter(r => r.status === statusFilter);
    }

    return reports;
  };

  const filteredReports = getFilteredReports();

  // Calculate stats
  const stats = {
    pending: allReports.filter(r => r.status === "reported").length,
    verified: allReports.filter(r => r.status === "verified").length,
    responding: allReports.filter(r => r.status === "responding").length,
    flagged: flaggedReports.length,
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500 text-white";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-yellow-500 text-white";
      case "low": return "bg-blue-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "reported": return <Badge variant="outline">Pending</Badge>;
      case "verified": return <Badge className="bg-green-500 text-white">Verified</Badge>;
      case "responding": return <Badge className="bg-blue-500 text-white">Responding</Badge>;
      case "resolved": return <Badge className="bg-gray-500 text-white">Resolved</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!isAuthorized) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="text-center">Access Denied</CardTitle>
              <CardDescription className="text-center">
                This dashboard is only accessible to Admin and NGO users.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading admin dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
            <Shield className="w-10 h-10" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Disaster feed management, verification tools, and volunteer coordination
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting verification</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.verified}</div>
              <p className="text-xs text-muted-foreground">Confirmed incidents</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Responding</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.responding}</div>
              <p className="text-xs text-muted-foreground">Active response</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Flagged</CardTitle>
              <Flag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.flagged}</div>
              <p className="text-xs text-muted-foreground">Needs review</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="reported">Pending</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="responding">Responding</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Disaster Feed with Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all-reports">
              All Reports
            </TabsTrigger>
            <TabsTrigger value="prioritized" data-testid="tab-prioritized">
              <TrendingUp className="w-4 h-4 mr-2" />
              AI Prioritized
            </TabsTrigger>
            <TabsTrigger value="flagged" data-testid="tab-flagged">
              <Flag className="w-4 h-4 mr-2" />
              Flagged
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="users" data-testid="tab-users">
                <Users className="w-4 h-4 mr-2" />
                User Management
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredReports.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No reports to display</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredReports.map((report) => (
                  <Card key={report.id} data-testid={`report-card-${report.id}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle>{report.title}</CardTitle>
                            {report.flagType && (
                              <Badge variant="destructive" className="ml-2">
                                <Flag className="w-3 h-3 mr-1" />
                                {report.flagType.replace("_", " ")}
                              </Badge>
                            )}
                          </div>
                          <CardDescription>
                            <div className="flex flex-wrap gap-2 items-center">
                              <Badge className={getSeverityColor(report.severity)}>
                                {report.severity}
                              </Badge>
                              {getStatusBadge(report.status)}
                              <span className="flex items-center gap-1 text-sm">
                                <MapPin className="w-3 h-3" />
                                {report.location}
                              </span>
                              {report.priorityScore && (
                                <Badge variant="outline">
                                  Priority: {report.priorityScore}
                                </Badge>
                              )}
                            </div>
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm mb-4">{report.description}</p>
                      {report.adminNotes && (
                        <div className="bg-muted p-3 rounded-md mb-4">
                          <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            Admin Notes:
                          </p>
                          <p className="text-sm">{report.adminNotes}</p>
                        </div>
                      )}
                      {report.aiValidationNotes && (
                        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md mb-4">
                          <p className="text-xs font-semibold mb-1">
                            AI Validation (Score: {report.aiValidationScore}/100):
                          </p>
                          <p className="text-sm">{report.aiValidationNotes}</p>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedReport(report);
                          setFlagDialogOpen(true);
                        }}
                        data-testid={`button-flag-${report.id}`}
                      >
                        <Flag className="w-4 h-4 mr-2" />
                        Flag Report
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedReport(report);
                          setAssignDialogOpen(true);
                        }}
                        data-testid={`button-assign-${report.id}`}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Assign
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedReport(report);
                          setAdminNotes(report.adminNotes || "");
                          setNotesDialogOpen(true);
                        }}
                        data-testid={`button-notes-${report.id}`}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Add Notes
                      </Button>
                      {report.status === "reported" && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            updateStatusMutation.mutate({
                              reportId: report.id,
                              status: "verified",
                            });
                          }}
                          data-testid={`button-verify-${report.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark Verified
                        </Button>
                      )}
                      {report.status === "verified" && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            updateStatusMutation.mutate({
                              reportId: report.id,
                              status: "resolved",
                            });
                          }}
                          data-testid={`button-resolve-${report.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark Resolved
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* User Management Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="users" className="mt-6">
              {isLoadingAllUsers ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading users...</p>
                  </CardContent>
                </Card>
              ) : allUsers.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No users found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {allUsers.map((usr) => (
                    <Card key={usr.id} data-testid={`user-card-${usr.id}`}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle>{usr.name || usr.email}</CardTitle>
                              <Badge variant="outline" className="capitalize">
                                {usr.role || "citizen"}
                              </Badge>
                            </div>
                            <CardDescription>
                              <div className="flex flex-col gap-1 text-sm">
                                <span>Email: {usr.email}</span>
                                {usr.phoneNumber && (
                                  <span>Phone: {usr.phoneNumber}</span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  Joined: {new Date(usr.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardFooter className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(usr);
                            setNewRole(usr.role || "citizen");
                            setRoleDialogOpen(true);
                          }}
                          disabled={usr.id === user?.id}
                          data-testid={`button-change-role-${usr.id}`}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Change Role
                        </Button>
                        {usr.id === user?.id && (
                          <Badge variant="secondary" className="ml-2">
                            You
                          </Badge>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

        {/* Flag Dialog */}
        <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Flag Report</DialogTitle>
              <DialogDescription>
                Mark this report as false, duplicate, or spam
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Select value={flagType} onValueChange={setFlagType}>
                <SelectTrigger data-testid="select-flag-type">
                  <SelectValue placeholder="Select flag type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false_report">False Report</SelectItem>
                  <SelectItem value="duplicate">Duplicate</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Add admin notes (optional)"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                data-testid="textarea-flag-notes"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFlagDialogOpen(false)} data-testid="button-cancel-flag">
                Cancel
              </Button>
              <Button onClick={handleFlagReport} data-testid="button-confirm-flag">
                Flag Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Report</DialogTitle>
              <DialogDescription>
                Assign this report to a volunteer or team member
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {isLoadingUsers ? (
                <div className="text-center py-4">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading volunteers...</p>
                </div>
              ) : assignableUsers.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No volunteers available</p>
                </div>
              ) : (
                <Select value={selectedVolunteer} onValueChange={setSelectedVolunteer}>
                  <SelectTrigger data-testid="select-volunteer">
                    <SelectValue placeholder="Select a volunteer or team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <span>{user.name || user.email}</span>
                          <Badge variant="outline" className="text-xs">
                            {user.role}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)} data-testid="button-cancel-assign">
                Cancel
              </Button>
              <Button 
                onClick={handleAssignReport} 
                disabled={!selectedVolunteer || isLoadingUsers} 
                data-testid="button-confirm-assign"
              >
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Notes Dialog */}
        <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Admin Notes</DialogTitle>
              <DialogDescription>
                Add or update admin notes for this report
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Enter admin notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={6}
                data-testid="textarea-admin-notes"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesDialogOpen(false)} data-testid="button-cancel-notes">
                Cancel
              </Button>
              <Button onClick={handleAddNotes} disabled={!adminNotes.trim()} data-testid="button-save-notes">
                Save Notes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Role Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change User Role</DialogTitle>
              <DialogDescription>
                Update the role for {selectedUser?.name || selectedUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger data-testid="select-new-role">
                  <SelectValue placeholder="Select new role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="citizen">Citizen</SelectItem>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                  <SelectItem value="ngo">NGO</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-md">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> Changing user roles affects their access permissions. 
                  Admin roles have full system access.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)} data-testid="button-cancel-role">
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateUserRole} 
                disabled={!newRole || newRole === selectedUser?.role}
                data-testid="button-confirm-role"
              >
                Update Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
