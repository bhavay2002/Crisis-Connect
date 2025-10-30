import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";

// Pages
import Landing from "@/pages/auth/Landing";
import Dashboard from "@/pages/feed/Dashboard";
import ActiveReports from "@/pages/feed/ActiveReports";
import SubmitReport from "@/pages/SubmitReport";
import RoleSelection from "@/pages/auth/RoleSelection";
import Map from "@/pages/explore/Map";
import ResourceRequests from "@/pages/ResourceRequests";
import SubmitResourceRequest from "@/pages/SubmitResourceRequest";
import AidOffers from "@/pages/AidOffers";
import SubmitAidOffer from "@/pages/SubmitAidOffer";
import AidOfferMatches from "@/pages/AidOfferMatches";
import AidMatchingDashboard from "@/pages/AidMatchingDashboard";
import AdminDashboard from "@/pages/feed/AdminDashboard";
import VolunteerDashboard from "@/pages/VolunteerDashboard";
import ResourceManagement from "@/pages/ResourceManagement";
import AnalyticsDashboard from "@/pages/feed/AnalyticsDashboard";
import Notifications from "@/pages/Notifications";
import NotificationPreferences from "@/pages/NotificationPreferences";
import UserProfile from "@/pages/UserProfile";
import IdentityVerification from "@/pages/IdentityVerification";
import ReputationDashboard from "@/pages/ReputationDashboard";
import ClusterManagementPage from "@/pages/ClusterManagementPage";
import ImageClassification from "@/pages/ImageClassification";
import PredictiveModeling from "@/pages/PredictiveModeling";
import MatchingEngine from "@/pages/MatchingEngine";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/:rest*" component={Landing} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/volunteer" component={VolunteerDashboard} />
          <Route path="/reports" component={ActiveReports} />
          <Route path="/submit" component={SubmitReport} />
          <Route path="/map" component={Map} />
          <Route path="/resource-requests" component={ResourceRequests} />
          <Route path="/submit-resource-request" component={SubmitResourceRequest} />
          <Route path="/aid-offers" component={AidOffers} />
          <Route path="/submit-aid-offer" component={SubmitAidOffer} />
          <Route path="/aid-offers/:offerId/matches" component={AidOfferMatches} />
          <Route path="/aid-matching" component={AidMatchingDashboard} />
          <Route path="/matching-engine" component={MatchingEngine} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/resource-management" component={ResourceManagement} />
          <Route path="/analytics" component={AnalyticsDashboard} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/notification-preferences" component={NotificationPreferences} />
          <Route path="/profile" component={UserProfile} />
          <Route path="/verify" component={IdentityVerification} />
          <Route path="/reputation" component={ReputationDashboard} />
          <Route path="/clusters" component={ClusterManagementPage} />
          <Route path="/classify" component={ImageClassification} />
          <Route path="/predictions" component={PredictiveModeling} />
          <Route path="/select-role" component={RoleSelection} />
          <Route path="/my-reports" component={Dashboard} />
          <Route path="/teams" component={Dashboard} />
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
