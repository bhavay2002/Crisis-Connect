import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, Users, Building2, UserCircle, Landmark } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const roles = [
  {
    value: "citizen",
    label: "Citizen",
    description: "Report and verify emergencies in your area",
    icon: UserCircle,
  },
  {
    value: "volunteer",
    label: "Volunteer",
    description: "Help coordinate emergency responses",
    icon: Users,
  },
  {
    value: "ngo",
    label: "NGO/Organization",
    description: "Manage relief operations and resources",
    icon: Building2,
  },
  {
    value: "government",
    label: "Government Official",
    description: "Access administrative data and coordinate disaster response",
    icon: Landmark,
  },
  {
    value: "admin",
    label: "Admin",
    description: "System administration and oversight",
    icon: Shield,
  },
];

export default function RoleSelection() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<string>(user?.role || "citizen");

  // Update selected role when user data loads
  useEffect(() => {
    if (user?.role) {
      setSelectedRole(user.role);
    }
  }, [user?.role]);

  const updateRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      const response = await fetch("/api/auth/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error("Failed to update role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: "Your role has been updated successfully",
      });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update role. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    updateRoleMutation.mutate(selectedRole);
  };

  // Filter roles based on current user's role
  const availableRoles = roles.filter((role) => {
    // Admins can only select admin (prevent accidental demotion)
    if (user?.role === "admin") {
      return role.value === "admin";
    }
    // Non-admins cannot select admin
    return role.value !== "admin";
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Select Your Role</CardTitle>
          <CardDescription>
            Choose how you'd like to participate in emergency response
            {user?.role === "admin" && (
              <span className="block mt-2 text-destructive">
                Note: Admins cannot change their role. Contact another admin if needed.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={selectedRole}
            onValueChange={setSelectedRole}
            className="grid gap-4"
          >
            {availableRoles.map((role) => {
              const Icon = role.icon;
              return (
                <div key={role.value}>
                  <RadioGroupItem
                    value={role.value}
                    id={role.value}
                    className="peer sr-only"
                    data-testid={`radio-role-${role.value}`}
                  />
                  <Label
                    htmlFor={role.value}
                    className="flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer hover-elevate peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                    data-testid={`label-role-${role.value}`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="font-semibold">{role.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {role.description}
                      </div>
                    </div>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
          <Button
            onClick={handleSubmit}
            disabled={updateRoleMutation.isPending || selectedRole === user?.role}
            className="w-full"
            data-testid="button-submit-role"
          >
            {updateRoleMutation.isPending ? "Saving..." : selectedRole === user?.role ? "No Changes" : "Continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
