import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Mail, 
  Phone, 
  CreditCard, 
  CheckCircle2, 
  Send,
  Shield,
  AlertCircle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function IdentityVerification() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [emailCode, setEmailCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");

  const [emailOTPSent, setEmailOTPSent] = useState(false);
  const [phoneOTPSent, setPhoneOTPSent] = useState(false);
  const [devOTP, setDevOTP] = useState("");

  // Send Email Verification
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/send-email-verification");
    },
    onSuccess: (data: any) => {
      setEmailOTPSent(true);
      if (data.devOTP) {
        setDevOTP(data.devOTP);
      }
      toast({
        title: "Verification Code Sent",
        description: "Check your email for the verification code.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Code",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  // Verify Email
  const verifyEmailMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/verify-email", { code: emailCode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Email Verified",
        description: "Your email has been successfully verified!",
      });
      setEmailCode("");
      setEmailOTPSent(false);
      setDevOTP("");
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid or expired code.",
        variant: "destructive",
      });
    },
  });

  // Send Phone Verification
  const sendPhoneMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/send-phone-verification", { phoneNumber });
    },
    onSuccess: (data: any) => {
      setPhoneOTPSent(true);
      if (data.devOTP) {
        setDevOTP(data.devOTP);
      }
      toast({
        title: "Verification Code Sent",
        description: `Check your phone ${phoneNumber} for the code.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Code",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  // Verify Phone
  const verifyPhoneMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/verify-phone", { code: phoneCode, phoneNumber });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Phone Verified",
        description: "Your phone number has been successfully verified!",
      });
      setPhoneCode("");
      setPhoneOTPSent(false);
      setPhoneNumber("");
      setDevOTP("");
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid or expired code.",
        variant: "destructive",
      });
    },
  });

  // Verify Aadhaar
  const verifyAadhaarMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/verify-aadhaar", { aadhaarNumber });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reputation/mine"] });
      toast({
        title: "Aadhaar Verified",
        description: data.note || "Your Aadhaar has been successfully verified!",
      });
      setAadhaarNumber("");
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Please check your Aadhaar number.",
        variant: "destructive",
      });
    },
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Please sign in to verify your identity</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Identity Verification
        </h1>
        <p className="text-muted-foreground mt-2">
          Complete your identity verification to increase trust and unlock features
        </p>
      </div>

      {devOTP && (
        <Alert className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900 dark:text-amber-100">
            <strong>Development Mode:</strong> Your verification code is: <code className="font-mono font-bold">{devOTP}</code>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-1">
        {/* Email Verification */}
        {!user.emailVerified && (
          <Card data-testid="card-email-verification">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Verification
              </CardTitle>
              <CardDescription>Verify your email: {user.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!emailOTPSent ? (
                <Button
                  onClick={() => sendEmailMutation.mutate()}
                  disabled={sendEmailMutation.isPending}
                  className="w-full"
                  data-testid="button-send-email-code"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendEmailMutation.isPending ? "Sending..." : "Send Verification Code"}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email-code">Enter Verification Code</Label>
                    <Input
                      id="email-code"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                      maxLength={6}
                      data-testid="input-email-code"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => verifyEmailMutation.mutate()}
                      disabled={!emailCode || verifyEmailMutation.isPending}
                      className="flex-1"
                      data-testid="button-verify-email"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {verifyEmailMutation.isPending ? "Verifying..." : "Verify Email"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEmailOTPSent(false);
                        setEmailCode("");
                        setDevOTP("");
                      }}
                      data-testid="button-cancel-email"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Phone Verification */}
        {!user.phoneVerified && (
          <Card data-testid="card-phone-verification">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Phone Verification
              </CardTitle>
              <CardDescription>Verify your phone number for enhanced security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!phoneOTPSent ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phone-number">Phone Number</Label>
                    <Input
                      id="phone-number"
                      type="tel"
                      placeholder="+91 1234567890"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      data-testid="input-phone-number"
                    />
                  </div>
                  <Button
                    onClick={() => sendPhoneMutation.mutate()}
                    disabled={!phoneNumber || sendPhoneMutation.isPending}
                    className="w-full"
                    data-testid="button-send-phone-code"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendPhoneMutation.isPending ? "Sending..." : "Send Verification Code"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phone-code">Enter Verification Code</Label>
                    <Input
                      id="phone-code"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      maxLength={6}
                      data-testid="input-phone-code"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => verifyPhoneMutation.mutate()}
                      disabled={!phoneCode || verifyPhoneMutation.isPending}
                      className="flex-1"
                      data-testid="button-verify-phone"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {verifyPhoneMutation.isPending ? "Verifying..." : "Verify Phone"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPhoneOTPSent(false);
                        setPhoneCode("");
                        setDevOTP("");
                      }}
                      data-testid="button-cancel-phone"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Aadhaar Verification */}
        {!user.aadhaarVerified && (
          <Card data-testid="card-aadhaar-verification">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Aadhaar Verification
              </CardTitle>
              <CardDescription>Verify your Aadhaar for complete identity verification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Demo Mode:</strong> This is a simulated verification. In production, this would integrate with UIDAI's official API.
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="aadhaar-number">Aadhaar Number</Label>
                <Input
                  id="aadhaar-number"
                  type="text"
                  placeholder="Enter 12-digit Aadhaar number"
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ""))}
                  maxLength={12}
                  data-testid="input-aadhaar-number"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  For demo: Enter any 12-digit number
                </p>
              </div>

              <Button
                onClick={() => verifyAadhaarMutation.mutate()}
                disabled={aadhaarNumber.length !== 12 || verifyAadhaarMutation.isPending}
                className="w-full"
                data-testid="button-verify-aadhaar"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {verifyAadhaarMutation.isPending ? "Verifying..." : "Verify Aadhaar"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* All Verified */}
        {user.emailVerified && user.phoneVerified && user.aadhaarVerified && (
          <Card className="border-green-500" data-testid="card-all-verified">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
                All Verifications Complete!
              </CardTitle>
              <CardDescription>
                You have completed all identity verifications. Your trust score has been boosted!
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
