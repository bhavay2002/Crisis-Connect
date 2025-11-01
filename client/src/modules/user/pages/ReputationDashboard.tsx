import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Award, 
  TrendingUp, 
  Shield, 
  Heart,
  CheckCircle2,
  ThumbsUp,
  Package,
  Clock,
  Target,
  Trophy
} from "lucide-react";
import type { UserReputation } from "@shared/schema";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function ReputationDashboard() {
  const { user } = useAuth();

  const { data: reputation, isLoading } = useQuery<UserReputation>({
    queryKey: ["/api/reputation/mine"],
    enabled: !!user,
  });

  const getTrustLevel = (score: number) => {
    if (score >= 80) return { label: "Excellent", color: "text-green-600", variant: "default" as const };
    if (score >= 60) return { label: "Good", color: "text-blue-600", variant: "secondary" as const };
    if (score >= 40) return { label: "Fair", color: "text-yellow-600", variant: "outline" as const };
    return { label: "Building", color: "text-orange-600", variant: "outline" as const };
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 max-w-6xl">
        {!user ? (
          <Card className="w-full max-w-md mx-auto">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Please sign in to view your reputation</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !reputation ? (
          <Card className="w-full max-w-md mx-auto">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No reputation data available</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Award className="h-8 w-8" />
                Reputation Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">
                Track your contributions and build trust in the community
              </p>
            </div>

            <ReputationContent user={user} reputation={reputation} getTrustLevel={getTrustLevel} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function ReputationContent({ user, reputation, getTrustLevel }: { user: any, reputation: UserReputation, getTrustLevel: (score: number) => any }) {
  const trustLevel = getTrustLevel(reputation.trustScore);

  const achievements = [
    {
      id: "verified_contributor",
      title: "Verified Contributor",
      description: "Complete identity verification",
      icon: Shield,
      unlocked: user.emailVerified && user.phoneVerified,
      progress: [user.emailVerified, user.phoneVerified, user.aadhaarVerified].filter(Boolean).length,
      total: 3,
    },
    {
      id: "report_master",
      title: "Report Master",
      description: "Submit 10 verified reports",
      icon: CheckCircle2,
      unlocked: reputation.verifiedReports >= 10,
      progress: reputation.verifiedReports,
      total: 10,
    },
    {
      id: "community_validator",
      title: "Community Validator",
      description: "Verify 25 reports",
      icon: ThumbsUp,
      unlocked: reputation.verificationsGiven >= 25,
      progress: reputation.verificationsGiven,
      total: 25,
    },
    {
      id: "helper",
      title: "Community Helper",
      description: "Provide 5 resources",
      icon: Package,
      unlocked: reputation.resourcesProvided >= 5,
      progress: reputation.resourcesProvided,
      total: 5,
    },
    {
      id: "trusted_reporter",
      title: "Trusted Reporter",
      description: "Reach 75+ trust score",
      icon: Trophy,
      unlocked: reputation.trustScore >= 75,
      progress: reputation.trustScore,
      total: 75,
    },
  ];

  return (
    <>
      <div className="mb-6" style={{ display: 'none' }}>
      </div>

      {/* Trust Score Card */}
      <Card className="mb-6" data-testid="card-trust-score">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trust Score
          </CardTitle>
          <CardDescription>Your reputation in the Crisis Connect community</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-5xl font-bold" data-testid="text-trust-score-value">
                {reputation.trustScore}
              </div>
              <Badge variant={trustLevel.variant} className="mt-2" data-testid="badge-trust-level">
                {trustLevel.label}
              </Badge>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground text-sm">Trust Level</div>
              <div className={`text-2xl font-semibold ${trustLevel.color}`}>
                {trustLevel.label}
              </div>
            </div>
          </div>
          <Progress value={reputation.trustScore} className="h-3" data-testid="progress-trust-score" />
          <p className="text-sm text-muted-foreground mt-2">
            Complete verifications and contribute to increase your trust score
          </p>
        </CardContent>
      </Card>

      {/* Contribution Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card data-testid="card-stat-reports">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-total-reports">{reputation.totalReports}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {reputation.verifiedReports} verified
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-verifications">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verifications Given</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-verifications">{reputation.verificationsGiven}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Helping validate reports
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-upvotes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upvotes Received</CardTitle>
            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-upvotes">{reputation.upvotesReceived}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Community trust in reports
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-resources">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resources Provided</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-resources">{reputation.resourcesProvided}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {reputation.resourcesFulfilled} fulfilled
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-false-reports">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accuracy</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-accuracy">
              {reputation.totalReports > 0 
                ? Math.round(((reputation.totalReports - reputation.falseReports) / reputation.totalReports) * 100)
                : 100}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {reputation.falseReports} false reports
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-response-time">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-response-time">
              {reputation.responseTimeAvg ? `${Math.round(reputation.responseTimeAvg / 60)}m` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              For aid delivery
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Achievements */}
      <Card data-testid="card-achievements">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Achievements
          </CardTitle>
          <CardDescription>Unlock badges by contributing to the community</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {achievements.map((achievement) => {
              const Icon = achievement.icon;
              const progressPercentage = Math.min((achievement.progress / achievement.total) * 100, 100);

              return (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-lg border-2 ${
                    achievement.unlocked 
                      ? "border-primary bg-primary/5" 
                      : "border-muted bg-muted/30"
                  }`}
                  data-testid={`achievement-${achievement.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${
                      achievement.unlocked 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{achievement.title}</h4>
                        {achievement.unlocked && (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {achievement.description}
                      </p>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Progress</span>
                          <span>{achievement.progress}/{achievement.total}</span>
                        </div>
                        <Progress value={progressPercentage} className="h-2" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* How to Improve */}
      <Card className="mt-6" data-testid="card-improvement-tips">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Ways to Improve Your Reputation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <span>Complete identity verification (email, phone, Aadhaar) for +10 trust score bonus</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <span>Submit accurate disaster reports that get verified by the community</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <span>Help verify other reports to build community trust</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <span>Provide and deliver resources to those in need</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <span>Respond quickly to aid requests to improve your response time</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
