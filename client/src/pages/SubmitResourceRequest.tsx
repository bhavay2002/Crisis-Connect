import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Package, Droplet, Home, Plus, Shirt, HelpCircle, Wind } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertResourceRequestSchema } from "@shared/schema";

const formSchema = insertResourceRequestSchema.omit({ userId: true });

const resourceIcons = {
  food: Package,
  water: Droplet,
  shelter: Home,
  medical: Plus,
  clothing: Shirt,
  blankets: Wind,
  other: HelpCircle,
};

export default function SubmitResourceRequest() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      resourceType: undefined,
      urgency: undefined,
      quantity: 1,
      description: "",
      location: "",
      contactInfo: "",
      disasterReportId: undefined,
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return apiRequest("POST", "/api/resource-requests", data);
    },
    onSuccess: () => {
      toast({
        title: "Request Submitted",
        description: "Your resource request has been submitted successfully.",
      });
      navigate("/resource-requests");
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit resource request. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    submitMutation.mutate(data);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Request Resources</h1>
        <p className="text-muted-foreground">
          Submit a request for essential supplies and resources during an emergency
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resource Request Form</CardTitle>
          <CardDescription>
            Fill out the form below to request resources. Our volunteers and NGOs will work to fulfill your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="resourceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resource Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-resource-type">
                          <SelectValue placeholder="Select resource type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="food">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            <span>Food</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="water">
                          <div className="flex items-center gap-2">
                            <Droplet className="h-4 w-4" />
                            <span>Water</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="shelter">
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4" />
                            <span>Shelter</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="medical">
                          <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            <span>Medical Supplies</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="clothing">
                          <div className="flex items-center gap-2">
                            <Shirt className="h-4 w-4" />
                            <span>Clothing</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="blankets">
                          <div className="flex items-center gap-2">
                            <Wind className="h-4 w-4" />
                            <span>Blankets</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="other">
                          <div className="flex items-center gap-2">
                            <HelpCircle className="h-4 w-4" />
                            <span>Other</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="urgency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Urgency Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-urgency">
                          <SelectValue placeholder="Select urgency level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low - Can wait several days</SelectItem>
                        <SelectItem value="medium">Medium - Needed within 1-2 days</SelectItem>
                        <SelectItem value="high">High - Needed within 24 hours</SelectItem>
                        <SelectItem value="critical">Critical - Needed immediately</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Number of units needed"
                        data-testid="input-quantity"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what you need and any specific requirements"
                        className="resize-none"
                        rows={4}
                        data-testid="input-description"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Where do you need these resources delivered?"
                        data-testid="input-location"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Information (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Phone number or additional contact details"
                        data-testid="input-contact-info"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/resource-requests")}
                  disabled={isSubmitting}
                  data-testid="button-cancel"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="button-submit"
                  className="flex-1"
                >
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
