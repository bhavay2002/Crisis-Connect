import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Shield, Activity, MapPin, Clock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ResponseTeams() {
  const { user } = useAuth();

  const canManageTeams = user?.role && ["volunteer", "ngo", "admin"].includes(user.role);

  if (!canManageTeams) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-4 md:p-6 max-w-4xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              Response Teams are only available to volunteers, NGOs, and administrators.
              Please update your role to access team management features.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  const exampleTeams = [
    {
      id: "1",
      name: "Emergency Medical Response",
      description: "First responders for medical emergencies and health crises",
      members: 12,
      activeIncidents: 3,
      location: "City Center",
      status: "active",
      leader: "Dr. Sarah Johnson",
    },
    {
      id: "2",
      name: "Disaster Relief Team",
      description: "General disaster response and resource distribution",
      members: 18,
      activeIncidents: 5,
      location: "Multiple Districts",
      status: "active",
      leader: "Mike Chen",
    },
    {
      id: "3",
      name: "Search and Rescue",
      description: "Specialized team for search and rescue operations",
      members: 8,
      activeIncidents: 1,
      location: "Mountain Region",
      status: "standby",
      leader: "Alex Rivera",
    },
  ];

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              Response Teams
            </h1>
            <p className="text-muted-foreground mt-2">
              Coordinate with response teams and manage emergency operations
            </p>
          </div>
          <Button data-testid="button-create-team">
            <UserPlus className="mr-2 h-4 w-4" />
            Create New Team
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          <Card data-testid="card-total-teams">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{exampleTeams.length}</div>
              <p className="text-xs text-muted-foreground">Active response teams</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-members">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {exampleTeams.reduce((sum, team) => sum + team.members, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Registered volunteers</p>
            </CardContent>
          </Card>

          <Card data-testid="card-active-incidents">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {exampleTeams.reduce((sum, team) => sum + team.activeIncidents, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Currently responding</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          {exampleTeams.map((team) => (
            <Card key={team.id} className="hover-elevate" data-testid={`card-team-${team.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">{team.name}</CardTitle>
                      <Badge
                        variant={team.status === "active" ? "default" : "secondary"}
                        data-testid={`badge-status-${team.id}`}
                      >
                        {team.status}
                      </Badge>
                    </div>
                    <CardDescription>{team.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{team.members}</p>
                      <p className="text-xs text-muted-foreground">Members</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{team.activeIncidents}</p>
                      <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{team.location}</p>
                      <p className="text-xs text-muted-foreground">Location</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{team.leader}</p>
                      <p className="text-xs text-muted-foreground">Team Leader</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" data-testid={`button-view-team-${team.id}`}>
                    View Details
                  </Button>
                  <Button variant="outline" size="sm" data-testid={`button-join-team-${team.id}`}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Join Team
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {exampleTeams.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No Response Teams</p>
              <p className="text-muted-foreground text-center mb-4 max-w-md">
                Create your first response team to coordinate emergency operations
              </p>
              <Button data-testid="button-create-first-team">
                <UserPlus className="mr-2 h-4 w-4" />
                Create First Team
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
