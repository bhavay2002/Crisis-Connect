import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Icon, LatLngExpression } from "leaflet";
import { DisasterReport } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import { Flame, Droplet, Mountain, Wind, Car, AlertTriangle, MapPin, Calendar, AlertCircle, ThumbsUp, ShieldCheck } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon issue with Webpack
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Configure default icon
const DefaultIcon = new Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Severity colors for map markers
const severityColors = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

// Create custom colored markers
const createColoredIcon = (color: string) => {
  const svgIcon = `
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.4 12.5 28.5 12.5 28.5S25 20.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${color}"/>
      <circle cx="12.5" cy="12.5" r="6" fill="white"/>
    </svg>
  `;
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
};

const typeIcons = {
  fire: Flame,
  flood: Droplet,
  earthquake: Mountain,
  storm: Wind,
  accident: Car,
  other: AlertTriangle,
};

const typeLabels = {
  fire: "Fire",
  flood: "Flood",
  earthquake: "Earthquake",
  storm: "Storm",
  accident: "Accident",
  other: "Other",
};

export default function Map() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<DisasterReport | null>(null);

  const { data: reports = [], isLoading } = useQuery<DisasterReport[]>({
    queryKey: ["/api/reports"],
  });

  // Filter reports based on selected filters
  const filteredReports = useMemo(() => {
    let filtered = reports.filter((report) => {
      // Only show reports with GPS coordinates (including valid 0 values)
      return report.latitude != null && report.longitude != null;
    });

    if (typeFilter !== "all") {
      filtered = filtered.filter((r) => r.type === typeFilter);
    }

    if (severityFilter !== "all") {
      filtered = filtered.filter((r) => r.severity === severityFilter);
    }

    if (timeFilter !== "all") {
      const now = new Date();
      const cutoffTime = new Date();
      
      switch (timeFilter) {
        case "1h":
          cutoffTime.setHours(now.getHours() - 1);
          break;
        case "24h":
          cutoffTime.setHours(now.getHours() - 24);
          break;
        case "7d":
          cutoffTime.setDate(now.getDate() - 7);
          break;
        case "30d":
          cutoffTime.setDate(now.getDate() - 30);
          break;
      }
      
      filtered = filtered.filter((r) => new Date(r.createdAt) >= cutoffTime);
    }

    return filtered;
  }, [reports, typeFilter, severityFilter, timeFilter]);

  // Calculate map center based on available reports
  const mapCenter: LatLngExpression = useMemo(() => {
    if (filteredReports.length > 0) {
      const lats = filteredReports.map((r) => parseFloat(r.latitude!)).filter(lat => !isNaN(lat));
      const lngs = filteredReports.map((r) => parseFloat(r.longitude!)).filter(lng => !isNaN(lng));
      
      if (lats.length > 0 && lngs.length > 0) {
        const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
        const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
        return [avgLat, avgLng];
      }
    }
    return [37.7749, -122.4194]; // Default to San Francisco
  }, [filteredReports]);

  const TypeIcon = selectedReport ? typeIcons[selectedReport.type] : AlertTriangle;

  return (
    <DashboardLayout>
    <div className="h-full flex flex-col">
      {/* Filters Bar */}
      <Card className="m-4 mb-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Interactive Disaster Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1.5 block">Disaster Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger data-testid="select-type-filter">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="fire">Fire</SelectItem>
                  <SelectItem value="flood">Flood</SelectItem>
                  <SelectItem value="earthquake">Earthquake</SelectItem>
                  <SelectItem value="storm">Storm</SelectItem>
                  <SelectItem value="accident">Accident</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1.5 block">Severity</label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger data-testid="select-severity-filter">
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1.5 block">Time Range</label>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger data-testid="select-time-filter">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setTypeFilter("all");
                  setSeverityFilter("all");
                  setTimeFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="mt-3 text-sm text-muted-foreground">
            Showing {filteredReports.length} of {reports.filter(r => {
              if (r.latitude == null || r.longitude == null) return false;
              const lat = parseFloat(r.latitude);
              const lng = parseFloat(r.longitude);
              return !isNaN(lat) && !isNaN(lng);
            }).length} reports with GPS coordinates
          </div>
        </CardContent>
      </Card>

      {/* Map Container */}
      <div className="flex-1 m-4 mt-2 rounded-lg overflow-hidden border">
        {isLoading ? (
          <div className="h-full flex items-center justify-center bg-muted">
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={filteredReports.length > 0 ? 10 : 4}
            style={{ height: "100%", width: "100%" }}
            data-testid="map-container"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {filteredReports.map((report) => {
              const lat = parseFloat(report.latitude!);
              const lng = parseFloat(report.longitude!);
              
              // Skip markers with invalid coordinates
              if (isNaN(lat) || isNaN(lng)) {
                return null;
              }
              
              const icon = createColoredIcon(severityColors[report.severity]);
              
              return (
                <Marker
                  key={report.id}
                  position={[lat, lng]}
                  icon={icon}
                  eventHandlers={{
                    click: () => setSelectedReport(report),
                  }}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <h3 className="font-semibold text-base mb-1">{report.title}</h3>
                      <div className="flex gap-2 mb-2">
                        <Badge variant={report.severity === "critical" ? "destructive" : "secondary"}>
                          {report.severity}
                        </Badge>
                        <Badge variant="outline">{typeLabels[report.type]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{report.description.substring(0, 100)}...</p>
                      <Button
                        size="sm"
                        onClick={() => setSelectedReport(report)}
                        data-testid={`button-view-details-${report.id}`}
                      >
                        View Details
                      </Button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}
      </div>

      {/* Report Detail Sheet */}
      <Sheet open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <SheetContent className="overflow-y-auto w-full sm:max-w-lg" data-testid="sheet-report-details">
          {selectedReport && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <TypeIcon className="w-5 h-5" />
                  {selectedReport.title}
                </SheetTitle>
                <SheetDescription>
                  Report ID: {selectedReport.id}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={selectedReport.severity === "critical" ? "destructive" : "secondary"}
                    data-testid="badge-severity"
                  >
                    {selectedReport.severity}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-type">
                    {typeLabels[selectedReport.type]}
                  </Badge>
                  <Badge variant="outline" data-testid="badge-status">
                    {selectedReport.status}
                  </Badge>
                  {selectedReport.verificationCount > 0 && (
                    <Badge variant="outline" data-testid="badge-verifications">
                      {selectedReport.verificationCount} verification{selectedReport.verificationCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>

                {/* Description */}
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-description">
                    {selectedReport.description}
                  </p>
                </div>

                {/* Location */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location
                  </h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-location">
                    {selectedReport.location}
                  </p>
                  {selectedReport.latitude != null && selectedReport.longitude != null && (
                    <p className="text-xs text-muted-foreground mt-1" data-testid="text-coordinates">
                      GPS: {parseFloat(selectedReport.latitude).toFixed(6)}, {parseFloat(selectedReport.longitude).toFixed(6)}
                    </p>
                  )}
                </div>

                {/* Timestamp */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Reported
                  </h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-timestamp">
                    {formatDistanceToNow(new Date(selectedReport.createdAt), { addSuffix: true })}
                  </p>
                </div>

                {/* Community Upvotes */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4" />
                    Community Upvotes
                  </h3>
                  <p className="text-sm text-muted-foreground" data-testid="text-upvote-count">
                    {selectedReport.verificationCount} {selectedReport.verificationCount === 1 ? 'person has' : 'people have'} upvoted this report
                  </p>
                </div>

                {/* Official Confirmation */}
                {selectedReport.confirmedBy && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-green-600" />
                      Official Confirmation
                    </h3>
                    <Badge variant="default" className="bg-green-600 hover:bg-green-700" data-testid="badge-officially-confirmed">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      CONFIRMED BY VERIFIED RESPONDER
                    </Badge>
                    {selectedReport.confirmedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Confirmed {formatDistanceToNow(new Date(selectedReport.confirmedAt), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                )}

                {/* AI Validation Score */}
                {selectedReport.aiValidationScore != null && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      AI Validation Score
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${selectedReport.aiValidationScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium" data-testid="text-ai-score">
                        {selectedReport.aiValidationScore}/100
                      </span>
                    </div>
                    {selectedReport.aiValidationNotes && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {selectedReport.aiValidationNotes}
                      </p>
                    )}
                  </div>
                )}

                {/* Media */}
                {selectedReport.mediaUrls && selectedReport.mediaUrls.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Media ({selectedReport.mediaUrls.length})</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedReport.mediaUrls.map((url, index) => (
                        <div
                          key={index}
                          className="aspect-video bg-muted rounded-md overflow-hidden"
                          data-testid={`media-item-${index}`}
                        >
                          <img
                            src={url}
                            alt={`Media ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3Ctext fill='%23999' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EMedia%3C/text%3E%3C/svg%3E";
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
    </DashboardLayout>
  );
}
