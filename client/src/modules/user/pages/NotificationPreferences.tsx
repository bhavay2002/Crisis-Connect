import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bell, Shield, AlertTriangle, Package, Users } from "lucide-react";

const preferencesSchema = z.object({
  disasterNearby: z.boolean(),
  disasterAssigned: z.boolean(),
  sosAlertNearby: z.boolean(),
  resourceRequestCreated: z.boolean(),
  resourceRequestFulfilled: z.boolean(),
  reportConfirmed: z.boolean(),
  reportDisputed: z.boolean(),
  volunteerAssigned: z.boolean(),
  ngoAssigned: z.boolean(),
  statusUpdate: z.boolean(),
});

type PreferencesFormData = z.infer<typeof preferencesSchema>;

interface NotificationPreferences {
  userId: string;
  disasterNearby: boolean;
  disasterAssigned: boolean;
  sosAlertNearby: boolean;
  resourceRequestCreated: boolean;
  resourceRequestFulfilled: boolean;
  reportConfirmed: boolean;
  reportDisputed: boolean;
  volunteerAssigned: boolean;
  ngoAssigned: boolean;
  statusUpdate: boolean;
}

const preferenceGroups = [
  {
    title: "Disaster Alerts",
    icon: AlertTriangle,
    preferences: [
      { key: "disasterNearby", label: "Disasters Near My Location", description: "Get notified when disasters are reported near you" },
      { key: "disasterAssigned", label: "Assigned Disasters", description: "Notifications for disasters you're assigned to" },
    ],
  },
  {
    title: "SOS Alerts",
    icon: Shield,
    preferences: [
      { key: "sosAlertNearby", label: "SOS Alerts Nearby", description: "Critical SOS alerts in your area" },
    ],
  },
  {
    title: "Resource Management",
    icon: Package,
    preferences: [
      { key: "resourceRequestCreated", label: "New Resource Requests", description: "When new resource requests are created" },
      { key: "resourceRequestFulfilled", label: "Resource Request Fulfilled", description: "When your resource requests are fulfilled" },
    ],
  },
  {
    title: "Report Status",
    icon: Bell,
    preferences: [
      { key: "reportConfirmed", label: "Report Confirmations", description: "When your reports are confirmed" },
      { key: "reportDisputed", label: "Report Disputes", description: "When your reports are disputed" },
      { key: "statusUpdate", label: "Status Updates", description: "General status updates on your reports" },
    ],
  },
  {
    title: "Team Assignments",
    icon: Users,
    preferences: [
      { key: "volunteerAssigned", label: "Volunteer Assignments", description: "When volunteers are assigned to incidents" },
      { key: "ngoAssigned", label: "NGO Assignments", description: "When NGOs are assigned to incidents" },
    ],
  },
];

export default function NotificationPreferences() {
  const { toast } = useToast();

  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/notifications/preferences"],
  });

  const form = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      disasterNearby: true,
      disasterAssigned: true,
      sosAlertNearby: true,
      resourceRequestCreated: true,
      resourceRequestFulfilled: true,
      reportConfirmed: true,
      reportDisputed: true,
      volunteerAssigned: true,
      ngoAssigned: true,
      statusUpdate: true,
    },
  });

  // Sync form with fetched preferences
  useEffect(() => {
    if (preferences) {
      form.reset({
        disasterNearby: preferences.disasterNearby,
        disasterAssigned: preferences.disasterAssigned,
        sosAlertNearby: preferences.sosAlertNearby,
        resourceRequestCreated: preferences.resourceRequestCreated,
        resourceRequestFulfilled: preferences.resourceRequestFulfilled,
        reportConfirmed: preferences.reportConfirmed,
        reportDisputed: preferences.reportDisputed,
        volunteerAssigned: preferences.volunteerAssigned,
        ngoAssigned: preferences.ngoAssigned,
        statusUpdate: preferences.statusUpdate,
      });
    }
  }, [preferences, form]);

  const updatePreferencesMutation = useMutation({
    mutationFn: (data: PreferencesFormData) =>
      apiRequest("/api/notifications/preferences", "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      toast({
        title: "Preferences Updated",
        description: "Your notification preferences have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update notification preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PreferencesFormData) => {
    updatePreferencesMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground dark:text-muted-foreground">Loading preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground dark:text-foreground mb-2">Notification Preferences</h1>
        <p className="text-muted-foreground dark:text-muted-foreground">
          Customize which notifications you want to receive
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {preferenceGroups.map((group, groupIndex) => (
            <Card key={group.title} data-testid={`card-preference-group-${groupIndex}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <group.icon className="h-5 w-5" />
                  {group.title}
                </CardTitle>
                <CardDescription>
                  Manage your {group.title.toLowerCase()} notification settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.preferences.map((pref, prefIndex) => (
                  <div key={pref.key}>
                    <FormField
                      control={form.control}
                      name={pref.key as keyof PreferencesFormData}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border dark:border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              {pref.label}
                            </FormLabel>
                            <FormDescription>
                              {pref.description}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid={`switch-${pref.key}`}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {prefIndex < group.preferences.length - 1 && (
                      <Separator className="my-4" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              data-testid="button-reset"
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={updatePreferencesMutation.isPending}
              data-testid="button-save"
            >
              {updatePreferencesMutation.isPending ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
