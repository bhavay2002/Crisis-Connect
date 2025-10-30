import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Home, Map as MapIcon, Navigation, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LayerControlProps {
  heatmapEnabled: boolean;
  onHeatmapToggle: (enabled: boolean) => void;
  heatmapDataSource: "all" | "reports" | "sos" | "resources";
  onHeatmapDataSourceChange: (source: "all" | "reports" | "sos" | "resources") => void;
  sheltersEnabled: boolean;
  onSheltersToggle: (enabled: boolean) => void;
  evacuationZonesEnabled: boolean;
  onEvacuationZonesToggle: (enabled: boolean) => void;
  roadsEnabled: boolean;
  onRoadsToggle: (enabled: boolean) => void;
}

export function LayerControl({
  heatmapEnabled,
  onHeatmapToggle,
  heatmapDataSource,
  onHeatmapDataSourceChange,
  sheltersEnabled,
  onSheltersToggle,
  evacuationZonesEnabled,
  onEvacuationZonesToggle,
  roadsEnabled,
  onRoadsToggle,
}: LayerControlProps) {
  return (
    <Card className="absolute top-4 right-4 z-[1000] w-64 shadow-lg" data-testid="layer-control">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Map Layers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="heatmap" className="flex items-center gap-2 cursor-pointer">
            <Activity className="w-4 h-4" />
            <span className="text-sm">High-Impact Heatmap</span>
          </Label>
          <Switch
            id="heatmap"
            checked={heatmapEnabled}
            onCheckedChange={onHeatmapToggle}
            data-testid="switch-heatmap"
          />
        </div>

        {heatmapEnabled && (
          <div className="ml-6 space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Data Source</Label>
            <Select value={heatmapDataSource} onValueChange={onHeatmapDataSourceChange}>
              <SelectTrigger className="h-8" data-testid="select-heatmap-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="reports">Disaster Reports</SelectItem>
                <SelectItem value="sos">SOS Alerts</SelectItem>
                <SelectItem value="resources">Resource Requests</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {heatmapDataSource === "all" && "Combining all data sources"}
              {heatmapDataSource === "reports" && "Showing disaster report density"}
              {heatmapDataSource === "sos" && "Showing active SOS alerts"}
              {heatmapDataSource === "resources" && "Showing pending resource requests"}
            </p>
          </div>
        )}

        <div className="border-t pt-3 space-y-3">
          <p className="text-xs text-muted-foreground font-medium">OVERLAYS</p>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="shelters" className="flex items-center gap-2 cursor-pointer">
              <Home className="w-4 h-4" />
              <span className="text-sm">Shelters</span>
              <Badge variant="secondary" className="text-xs">Demo</Badge>
            </Label>
            <Switch
              id="shelters"
              checked={sheltersEnabled}
              onCheckedChange={onSheltersToggle}
              data-testid="switch-shelters"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="evacuation" className="flex items-center gap-2 cursor-pointer">
              <MapIcon className="w-4 h-4" />
              <span className="text-sm">Evacuation Zones</span>
              <Badge variant="secondary" className="text-xs">Demo</Badge>
            </Label>
            <Switch
              id="evacuation"
              checked={evacuationZonesEnabled}
              onCheckedChange={onEvacuationZonesToggle}
              data-testid="switch-evacuation"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="roads" className="flex items-center gap-2 cursor-pointer">
              <Navigation className="w-4 h-4" />
              <span className="text-sm">Major Roads</span>
              <Badge variant="secondary" className="text-xs">Demo</Badge>
            </Label>
            <Switch
              id="roads"
              checked={roadsEnabled}
              onCheckedChange={onRoadsToggle}
              data-testid="switch-roads"
            />
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground">
            Demo overlays show sample data. Connect real data sources for production use.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
