import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Shield, MapPinned, Users, Bell, CheckCircle } from "lucide-react";
import heroImage from "@assets/generated_images/Emergency_response_team_coordination_9097dcd9.png";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/login";
  };

  const handleRegister = () => {
    window.location.href = "/register";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Emergency response team"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/80" />
        </div>

        <div className="relative z-10 container mx-auto px-6">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Crisis Connect
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8">
              Real-time disaster management and emergency response coordination.
              Report incidents, verify emergencies, and help save lives in your community.
            </p>
            <div className="flex flex-wrap gap-4 mb-12">
              <Button
                size="lg"
                onClick={handleRegister}
                className="text-lg px-8 py-6"
                data-testid="button-get-started"
              >
                Get Started
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleLogin}
                className="text-lg px-8 py-6 bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
                data-testid="button-login"
              >
                Sign In
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-white text-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                <span>10,000+ Lives Saved</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span>50,000+ Active Users</span>
              </div>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                <span>24/7 Emergency Support</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A crowd-sourced platform that enables rapid emergency response through
              community reporting and verification
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Report Emergencies</h3>
                <p className="text-muted-foreground">
                  Quickly report disasters and emergencies with detailed information,
                  location, and severity levels
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <CheckCircle className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Verify Reports</h3>
                <p className="text-muted-foreground">
                  Community members can verify disaster reports to confirm accuracy
                  and prioritize response efforts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
                  <MapPinned className="w-6 h-6 text-green-600 dark:text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Track Response</h3>
                <p className="text-muted-foreground">
                  Real-time updates on emergency response status and coordination
                  with response teams
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-muted">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Make a Difference?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of community members helping respond to emergencies
            and save lives
          </p>
          <Button
            size="lg"
            onClick={handleLogin}
            className="text-lg px-8 py-6"
            data-testid="button-join-now"
          >
            Join Crisis Connect
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t">
        <div className="container mx-auto text-center">
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" />
            256-bit Encryption • Secure Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
