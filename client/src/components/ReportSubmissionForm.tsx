import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, MapPin, FileText, Camera, CheckCircle } from "lucide-react";

export default function ReportSubmissionForm() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    type: "",
    severity: "",
    location: "",
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Report submitted", formData);
    setStep(5); // Success step
  };

  const steps = [
    { number: 1, title: "Type", icon: AlertTriangle },
    { number: 2, title: "Location", icon: MapPin },
    { number: 3, title: "Details", icon: FileText },
    { number: 4, title: "Review", icon: CheckCircle },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((s, index) => (
            <div key={s.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step >= s.number
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                  data-testid={`step-indicator-${s.number}`}
                >
                  {step > s.number ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <s.icon className="w-5 h-5" />
                  )}
                </div>
                <span className="text-xs mt-2 font-medium">{s.title}</span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    step > s.number ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 1 && "Select Emergency Type"}
            {step === 2 && "Provide Location"}
            {step === 3 && "Describe the Situation"}
            {step === 4 && "Review Your Report"}
            {step === 5 && "Report Submitted"}
          </CardTitle>
          <CardDescription>
            {step === 1 && "Choose the type of emergency you're reporting"}
            {step === 2 && "Where is the emergency happening?"}
            {step === 3 && "Provide detailed information about the emergency"}
            {step === 4 && "Review and submit your report"}
            {step === 5 && "Your report has been successfully submitted"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Emergency Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger data-testid="select-emergency-type">
                      <SelectValue placeholder="Select emergency type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fire">Fire</SelectItem>
                      <SelectItem value="flood">Flood</SelectItem>
                      <SelectItem value="earthquake">Earthquake</SelectItem>
                      <SelectItem value="storm">Storm</SelectItem>
                      <SelectItem value="accident">Accident</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="severity">Severity Level</Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(value) =>
                      setFormData({ ...formData, severity: value })
                    }
                  >
                    <SelectTrigger data-testid="select-severity">
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="Enter address or location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    data-testid="input-location"
                  />
                  <p className="text-xs text-muted-foreground">
                    Be as specific as possible (street address, landmarks, etc.)
                  </p>
                </div>
                <div className="h-48 bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    Map picker placeholder
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what's happening..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={6}
                    data-testid="textarea-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Upload Photos (Optional)</Label>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center hover-elevate">
                    <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG up to 10MB
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div>
                    <p className="text-sm font-medium">Emergency Type</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {formData.type || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Severity</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {formData.severity || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Location</p>
                    <p className="text-sm text-muted-foreground">
                      {formData.location || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Description</p>
                    <p className="text-sm text-muted-foreground">
                      {formData.description || "Not specified"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  Report Submitted Successfully
                </h3>
                <p className="text-muted-foreground mb-4">
                  Emergency services have been notified. Your report ID is{" "}
                  <span className="font-mono font-semibold">#ER-2024-001</span>
                </p>
                <Button onClick={() => setStep(1)} data-testid="button-submit-another">
                  Submit Another Report
                </Button>
              </div>
            )}

            {step < 5 && (
              <div className="flex justify-between mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(Math.max(1, step - 1))}
                  disabled={step === 1}
                  data-testid="button-previous"
                >
                  Previous
                </Button>
                {step < 4 ? (
                  <Button
                    type="button"
                    onClick={() => setStep(step + 1)}
                    data-testid="button-next"
                  >
                    Next
                  </Button>
                ) : (
                  <Button type="submit" data-testid="button-submit-report">
                    Submit Report
                  </Button>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
