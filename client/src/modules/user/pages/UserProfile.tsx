import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Mail, 
  Phone, 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Clock,
  UserCircle,
  Award,
  Settings
} from "lucide-react";
import { Link } from "wouter";
import type { UserReputation } from "@shared/schema";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function UserProfile() {
  const { user } = useAuth();

  const { data: reputation, isLoading: reputationLoading } = useQuery<UserReputation>({
    queryKey: ["/api/reputation/mine"],
    enabled: !!user,
  });

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Please sign in to view your profile</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "government":
        return "default";
      case "ngo":
        return "secondary";
      case "volunteer":
        return "outline";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "government":
        return "Government Official";
      case "ngo":
        return "NGO/Organization";
      case "volunteer":
        return "Volunteer";
      case "admin":
        return "Admin";
      default:
        return "Citizen";
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">My Profile</h1>
            <p className="text-muted-foreground">Manage your account and verification status</p>
          </div>
          <Link href="/select-role">
            <Button variant="outline" size="sm" data-testid="button-change-role">
              <Settings className="h-4 w-4 mr-2" />
              Change Role
            </Button>
          </Link>
        </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Info Card */}
        <Card data-testid="card-user-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {user.profileImageUrl ? (
                <img 
                  src={user.profileImageUrl} 
                  alt={user.name || "User"} 
                  className="h-16 w-16 rounded-full"
                  data-testid="img-avatar"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCircle className="h-8 w-8 text-primary" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-lg" data-testid="text-username">{user.name || "User"}</h3>
                <p className="text-sm text-muted-foreground" data-testid="text-email">{user.email}</p>
              </div>
            </div>

            <Separator />

            <div>
              <label className="text-sm text-muted-foreground">Role</label>
              <div className="mt-1">
                <Badge variant={getRoleBadgeVariant(user.role || "citizen")} data-testid={`badge-role-${user.role}`}>
                  {getRoleLabel(user.role || "citizen")}
                </Badge>
              </div>
            </div>

            {user.phoneNumber && (
              <div>
                <label className="text-sm text-muted-foreground">Phone Number</label>
                <p className="font-medium" data-testid="text-phone">{user.phoneNumber}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verification Status Card */}
        <Card data-testid="card-verification-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Verification Status
            </CardTitle>
            <CardDescription>Complete verifications to increase your trust score</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Email Verification */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
              {user.emailVerified ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" data-testid="icon-email-verified" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" data-testid="icon-email-unverified" />
              )}
            </div>

            {/* Phone Verification */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">
                    {user.phoneNumber || "Not provided"}
                  </p>
                </div>
              </div>
              {user.phoneVerified ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" data-testid="icon-phone-verified" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" data-testid="icon-phone-unverified" />
              )}
            </div>

            {/* Aadhaar Verification */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Aadhaar</p>
                  <p className="text-sm text-muted-foreground">
                    {user.aadhaarNumber ? `**** **** ${user.aadhaarNumber.slice(-4)}` : "Not provided"}
                  </p>
                </div>
              </div>
              {user.aadhaarVerified ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" data-testid="icon-aadhaar-verified" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" data-testid="icon-aadhaar-unverified" />
              )}
            </div>

            <Link href="/verify">
              <Button className="w-full mt-4" data-testid="button-complete-verification">
                Complete Verification
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Reputation Card */}
        <Card className="md:col-span-2" data-testid="card-reputation">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Reputation & Trust Score
            </CardTitle>
            <CardDescription>Your contributions to the Crisis Connect community</CardDescription>
          </CardHeader>
          <CardContent>
            {reputationLoading ? (
              <div className="flex items-center justify-center py-8">
                <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : reputation ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 rounded-lg bg-primary/10">
                  <div className="text-3xl font-bold text-primary" data-testid="text-trust-score">
                    {reputation.trustScore}
                  </div>
                  <div className="text-sm text-muted-foreground">Trust Score</div>
                </div>

                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold" data-testid="text-total-reports">
                    {reputation.totalReports}
                  </div>
                  <div className="text-sm text-muted-foreground">Reports Submitted</div>
                </div>

                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold" data-testid="text-verified-reports">
                    {reputation.verifiedReports}
                  </div>
                  <div className="text-sm text-muted-foreground">Verified Reports</div>
                </div>

                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold" data-testid="text-verifications-given">
                    {reputation.verificationsGiven}
                  </div>
                  <div className="text-sm text-muted-foreground">Verifications Given</div>
                </div>

                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold" data-testid="text-resources-provided">
                    {reputation.resourcesProvided}
                  </div>
                  <div className="text-sm text-muted-foreground">Resources Provided</div>
                </div>

                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold" data-testid="text-upvotes-received">
                    {reputation.upvotesReceived}
                  </div>
                  <div className="text-sm text-muted-foreground">Upvotes Received</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No reputation data available
              </div>
            )}

            <Link href="/reputation">
              <Button variant="outline" className="w-full mt-4" data-testid="button-view-reputation">
                View Full Reputation Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      </div>
    </DashboardLayout>
  );
}
