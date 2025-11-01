import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";

// Pages - Organized by feature modules
import Landing from "@/modules/auth/pages/Landing";
import Login from "@/modules/auth/pages/Login";
import Register from "@/modules/auth/pages/Register";
import RoleSelection from "@/modules/auth/pages/RoleSelection";
import Dashboard from "@/modules/reports/pages/Dashboard";
import ActiveReports from "@/modules/reports/pages/ActiveReports";
import SubmitReport from "@/modules/reports/pages/SubmitReport";
import ResourceRequests from "@/modules/resources/pages/ResourceRequests";
import ResourceManagement from "@/modules/resources/pages/ResourceManagement";
import SubmitResourceRequest from "@/modules/resources/pages/SubmitResourceRequest";
import AidOffers from "@/modules/aid/pages/AidOffers";
import SubmitAidOffer from "@/modules/aid/pages/SubmitAidOffer";
import AidOfferMatches from "@/modules/aid/pages/AidOfferMatches";
import AidMatchingDashboard from "@/modules/aid/pages/AidMatchingDashboard";
import VolunteerDashboard from "@/modules/aid/pages/VolunteerDashboard";
import MatchingEngine from "@/modules/aid/pages/MatchingEngine";
import AdminDashboard from "@/modules/admin/pages/AdminDashboard";
import ClusterManagementPage from "@/modules/admin/pages/ClusterManagementPage";
import AnalyticsDashboard from "@/modules/analytics/pages/AnalyticsDashboard";
import ImageClassification from "@/modules/analytics/pages/ImageClassification";
import PredictiveModeling from "@/modules/analytics/pages/PredictiveModeling";
import Map from "@/modules/map/pages/Map";
import UserProfile from "@/modules/user/pages/UserProfile";
import IdentityVerification from "@/modules/user/pages/IdentityVerification";
import ReputationDashboard from "@/modules/user/pages/ReputationDashboard";
import Notifications from "@/modules/user/pages/Notifications";
import NotificationPreferences from "@/modules/user/pages/NotificationPreferences";
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
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
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
          <Route path="/role-selection" component={RoleSelection} />
          <Route path="/my-reports" component={Dashboard} />
          <Route path="/teams" component={Dashboard} />
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
