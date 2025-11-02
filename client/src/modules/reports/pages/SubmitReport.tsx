import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UploadResult } from "@uppy/core";
import DashboardLayout from "@/components/layout/DashboardLayout";
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
import { AlertTriangle, MapPin, FileText, Camera, CheckCircle, Navigation, X, Image as ImageIcon, Mic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ObjectUploader } from "@/components/feed/ObjectUploader";
import { Badge } from "@/components/ui/badge";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { useLocation } from "wouter";

export default function SubmitReport() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    type: "",
    severity: "",
    location: "",
    latitude: "",
    longitude: "",
    title: "",
    description: "",
    mediaUrls: [] as string[],
  });
  const [gpsLoading, setGpsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ url: string; name: string }>>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Auto-capture GPS on component mount
  useEffect(() => {
    captureGPS();
  }, []);

  const submitMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("/api/reports", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Report submitted successfully",
        description: "Emergency services have been notified",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      setStep(5); // Success step
      setFormData({
        type: "",
        severity: "",
        location: "",
        latitude: "",
        longitude: "",
        title: "",
        description: "",
        mediaUrls: [],
      });
      setUploadedFiles([]);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          setLocation("/login");
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to submit report",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = {
      ...formData,
      mediaUrls: uploadedFiles.map(f => f.url),
    };
    submitMutation.mutate(dataToSubmit);
  };

  const captureGPS = () => {
    if (!navigator.geolocation) {
      toast({
        title: "GPS not available",
        description: "Your browser doesn't support geolocation",
        variant: "destructive",
      });
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setGpsLoading(false);
        toast({
          title: "GPS location captured",
          description: `Lat: ${position.coords.latitude.toFixed(6)}, Lon: ${position.coords.longitude.toFixed(6)}`,
        });
      },
      (error) => {
        setGpsLoading(false);
        toast({
          title: "GPS error",
          description: error.message || "Failed to capture GPS location",
          variant: "destructive",
        });
      }
    );
  };

  const handleGetUploadParameters = async () => {
    const response = await fetch("/api/objects/upload", {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    try {
      const newFiles: Array<{ url: string; name: string }> = [];
      
      for (const file of result.successful || []) {
        if (!file.uploadURL) continue;
        
        // Set ACL policy for the uploaded file
        const response = await fetch("/api/objects/media", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ mediaURL: file.uploadURL }),
        });

        if (response.ok) {
          const data = await response.json();
          newFiles.push({
            url: data.objectPath,
            name: file.name,
          });
        }
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);
      toast({
        title: "Upload successful",
        description: `${newFiles.length} file(s) uploaded`,
      });
    } catch (error) {
      console.error("Upload completion error:", error);
      toast({
        title: "Upload error",
        description: "Failed to process uploaded files",
        variant: "destructive",
      });
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleVoiceRecordingComplete = async (audioBlob: Blob, fileName: string) => {
    try {
      const uploadParams = await handleGetUploadParameters();
      
      const uploadResponse = await fetch(uploadParams.url, {
        method: uploadParams.method,
        body: audioBlob,
        headers: {
          'Content-Type': 'audio/webm',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const aclResponse = await fetch("/api/objects/media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mediaURL: uploadParams.url }),
      });

      if (aclResponse.ok) {
        const data = await aclResponse.json();
        setUploadedFiles(prev => [...prev, {
          url: data.objectPath,
          name: fileName,
        }]);
        toast({
          title: "Voice recording saved",
          description: "Your voice note has been attached to the report",
        });
      }
    } catch (error) {
      console.error("Voice upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload voice recording",
        variant: "destructive",
      });
    }
  };

  const steps = [
    { number: 1, title: "Type", icon: AlertTriangle },
    { number: 2, title: "Location", icon: MapPin },
    { number: 3, title: "Details", icon: FileText },
    { number: 4, title: "Review", icon: CheckCircle },
  ];

  const canProceed = () => {
    if (step === 1) return formData.type && formData.severity;
    if (step === 2) return formData.location;
    if (step === 3) return formData.title && formData.description;
    return true;
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2">Submit Emergency Report</h1>
          <p className="text-muted-foreground">
            Provide detailed information about the emergency situation
          </p>
        </div>

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
                          <SelectItem value="road_accident">Road Accident</SelectItem>
                          <SelectItem value="epidemic">Epidemic</SelectItem>
                          <SelectItem value="landslide">Landslide</SelectItem>
                          <SelectItem value="gas_leak">Gas Leak</SelectItem>
                          <SelectItem value="building_collapse">Building Collapse</SelectItem>
                          <SelectItem value="chemical_spill">Chemical Spill</SelectItem>
                          <SelectItem value="power_outage">Power Outage</SelectItem>
                          <SelectItem value="water_contamination">Water Contamination</SelectItem>
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
                    
                    <div className="space-y-2">
                      <Label>GPS Coordinates</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={captureGPS}
                          disabled={gpsLoading}
                          className="w-full"
                          data-testid="button-capture-gps"
                        >
                          <Navigation className="w-4 h-4 mr-2" />
                          {gpsLoading ? "Capturing..." : "Capture GPS Location"}
                        </Button>
                      </div>
                      {formData.latitude && formData.longitude && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs font-medium mb-1">Location Captured</p>
                          <p className="text-xs text-muted-foreground" data-testid="text-gps-coords">
                            Lat: {formData.latitude}, Lon: {formData.longitude}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Report Title</Label>
                      <Input
                        id="title"
                        placeholder="Brief title describing the emergency"
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        data-testid="input-title"
                      />
                    </div>
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
                      <Label>Upload Photos/Videos (Optional)</Label>
                      <ObjectUploader
                        maxNumberOfFiles={5}
                        maxFileSize={10485760}
                        allowedFileTypes={['image/*', 'video/*']}
                        onGetUploadParameters={handleGetUploadParameters}
                        onComplete={handleUploadComplete}
                        buttonVariant="outline"
                        buttonClassName="w-full"
                      >
                        <div className="flex items-center justify-center gap-2 py-6">
                          <Camera className="w-5 h-5" />
                          <span>Upload Photos/Videos</span>
                        </div>
                      </ObjectUploader>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Record Voice Note (Optional)</Label>
                      <VoiceRecorder onRecordingComplete={handleVoiceRecordingComplete} />
                      
                      {uploadedFiles.length > 0 && (
                        <div className="space-y-2 mt-3">
                          <p className="text-sm font-medium">Uploaded Files ({uploadedFiles.length})</p>
                          <div className="space-y-2">
                            {uploadedFiles.map((file, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-2 bg-muted rounded-lg"
                                data-testid={`uploaded-file-${index}`}
                              >
                                <div className="flex items-center gap-2">
                                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm truncate">{file.name}</span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeFile(index)}
                                  data-testid={`button-remove-file-${index}`}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
                        {formData.latitude && formData.longitude && (
                          <p className="text-xs text-muted-foreground mt-1">
                            GPS: {formData.latitude}, {formData.longitude}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">Title</p>
                        <p className="text-sm text-muted-foreground">
                          {formData.title || "Not specified"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Description</p>
                        <p className="text-sm text-muted-foreground">
                          {formData.description || "Not specified"}
                        </p>
                      </div>
                      {uploadedFiles.length > 0 && (
                        <div>
                          <p className="text-sm font-medium">Media Files</p>
                          <p className="text-sm text-muted-foreground">
                            {uploadedFiles.length} file(s) attached
                          </p>
                        </div>
                      )}
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
                      Emergency services have been notified. Your report will appear in the active reports feed.
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
                        disabled={!canProceed()}
                        data-testid="button-next"
                      >
                        Next
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={submitMutation.isPending}
                        data-testid="button-submit-report"
                      >
                        {submitMutation.isPending ? "Submitting..." : "Submit Report"}
                      </Button>
                    )}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
