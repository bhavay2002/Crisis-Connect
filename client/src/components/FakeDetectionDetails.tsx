import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  AlertTriangle,
  Camera,
  FileText,
  MapPin,
  Clock,
  Copy,
} from "lucide-react";
import type { DisasterReport } from "@shared/schema";
import { Separator } from "@/components/ui/separator";
import { FakeDetectionBadge } from "./FakeDetectionBadge";

interface FakeDetectionDetailsProps {
  report: DisasterReport;
}

export function FakeDetectionDetails({ report }: FakeDetectionDetailsProps) {
  if (!report.fakeDetectionScore && report.fakeDetectionScore !== 0) {
    return null;
  }

  const riskLevel = getRiskLevel(report.fakeDetectionScore);

  const imageMetadata = report.imageMetadata as any;
  const textAnalysis = report.textAnalysisResults as any;
  const flags = report.fakeDetectionFlags || [];
  const similarReports = report.similarReportIds || [];

  return (
    <Card className="border-orange-200 dark:border-orange-900" data-testid="card-fake-detection-details">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <CardTitle>Authenticity Analysis</CardTitle>
          </div>
          <FakeDetectionBadge
            score={report.fakeDetectionScore}
            flags={flags}
          />
        </div>
        <CardDescription>
          Automated analysis of report content, images, and metadata
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {riskLevel !== "low" && (
          <Alert variant={riskLevel === "critical" || riskLevel === "high" ? "destructive" : "default"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {riskLevel === "critical" && "Critical: Report Requires Manual Review"}
              {riskLevel === "high" && "Warning: Suspicious Patterns Detected"}
              {riskLevel === "medium" && "Notice: Minor Inconsistencies Found"}
            </AlertTitle>
            <AlertDescription>
              {riskLevel === "critical" &&
                "This report has multiple red flags. Admin review is strongly recommended before taking action."}
              {riskLevel === "high" &&
                "Several suspicious patterns were detected. Please verify this report with caution."}
              {riskLevel === "medium" &&
                "Some inconsistencies were found. Consider cross-checking with other sources."}
            </AlertDescription>
          </Alert>
        )}

        {flags.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Detected Issues ({flags.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {flags.map((flag, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-xs"
                  data-testid={`badge-flag-${index}`}
                >
                  {flag.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {textAnalysis && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Text Analysis
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Consistency Score</p>
                  <p className="font-medium" data-testid="text-consistency-score">
                    {textAnalysis.consistencyScore || 0}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Spam Patterns</p>
                  <p className="font-medium" data-testid="text-spam-detected">
                    {textAnalysis.hasSpamPatterns ? "Detected" : "None"}
                  </p>
                </div>
              </div>
              {textAnalysis.spamIndicators && textAnalysis.spamIndicators.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <p>Indicators: {textAnalysis.spamIndicators.join(", ")}</p>
                </div>
              )}
            </div>
          </>
        )}

        {imageMetadata && Array.isArray(imageMetadata) && imageMetadata.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Image Metadata Analysis ({imageMetadata.length} image{imageMetadata.length > 1 ? "s" : ""})
              </h4>
              {imageMetadata.map((meta: any, index: number) => (
                <div
                  key={index}
                  className="p-3 rounded-lg bg-muted/50 space-y-2 text-sm"
                  data-testid={`image-metadata-${index}`}
                >
                  <p className="font-medium">Image {index + 1}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">EXIF Data</p>
                      <p>{meta.hasExif ? "Present" : "Missing"}</p>
                    </div>
                    {meta.gpsCoordinates && (
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          GPS Match
                        </p>
                        <p>
                          {meta.gpsMatchesLocation === true
                            ? "✓ Matches"
                            : meta.gpsMatchesLocation === false
                            ? "✗ Mismatch"
                            : "Unknown"}
                        </p>
                      </div>
                    )}
                    {meta.timestamp && (
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Timestamp
                        </p>
                        <p>
                          {meta.timestampRecent === true
                            ? "✓ Recent"
                            : meta.timestampRecent === false
                            ? "✗ Old"
                            : new Date(meta.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {meta.cameraMake && (
                      <div>
                        <p className="text-muted-foreground">Camera</p>
                        <p className="truncate">{meta.cameraMake} {meta.cameraModel || ""}</p>
                      </div>
                    )}
                    {meta.software && (
                      <div>
                        <p className="text-muted-foreground">Software</p>
                        <p className="truncate">{meta.software}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {similarReports && similarReports.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Similar Reports Found ({similarReports.length})
              </h4>
              <p className="text-xs text-muted-foreground">
                This report is very similar to {similarReports.length} existing report{similarReports.length > 1 ? "s" : ""}.
                This could indicate a duplicate or coordinated fake reporting.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function getRiskLevel(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}
