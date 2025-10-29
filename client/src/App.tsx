import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";

// Pages
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import ActiveReports from "@/pages/ActiveReports";
import SubmitReport from "@/pages/SubmitReport";
import RoleSelection from "@/pages/RoleSelection";
import Map from "@/pages/Map";
import ResourceRequests from "@/pages/ResourceRequests";
import SubmitResourceRequest from "@/pages/SubmitResourceRequest";
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
          <Route path="/reports" component={ActiveReports} />
          <Route path="/submit" component={SubmitReport} />
          <Route path="/map" component={Map} />
          <Route path="/resource-requests" component={ResourceRequests} />
          <Route path="/submit-resource-request" component={SubmitResourceRequest} />
          <Route path="/select-role" component={RoleSelection} />
          <Route path="/my-reports" component={Dashboard} />
          <Route path="/teams" component={Dashboard} />
          <Route path="/analytics" component={Dashboard} />
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
