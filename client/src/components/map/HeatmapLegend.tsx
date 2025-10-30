import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

interface HeatmapLegendProps {
  dataSource: "all" | "reports" | "sos" | "resources";
}

export function HeatmapLegend({ dataSource }: HeatmapLegendProps) {
  return (
    <Card className="absolute bottom-4 left-4 z-[1000] w-64 shadow-lg" data-testid="heatmap-legend">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Heatmap Legend
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">INTENSITY SCALE</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-6 rounded" style={{
              background: 'linear-gradient(to right, rgba(0, 0, 255, 0.1), rgba(0, 255, 0, 0.4), rgba(255, 255, 0, 0.6), rgba(255, 0, 0, 0.8))'
            }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">DATA SOURCES</p>
          {dataSource === "all" && (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>Disaster Reports (by severity)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span>SOS Alerts (1.5x priority)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span>Resource Requests (by urgency)</span>
              </div>
            </div>
          )}
          {dataSource === "reports" && (
            <div className="text-xs">
              <p>Shows density of disaster reports weighted by severity level.</p>
            </div>
          )}
          {dataSource === "sos" && (
            <div className="text-xs">
              <p>Shows active SOS alerts weighted by severity with increased priority.</p>
            </div>
          )}
          {dataSource === "resources" && (
            <div className="text-xs">
              <p>Shows pending resource requests weighted by urgency level.</p>
            </div>
          )}
        </div>

        <div className="border-t pt-3 text-xs text-muted-foreground">
          <p className="font-medium mb-1">High-Impact Areas</p>
          <p>Brighter colors indicate higher concentration or severity of incidents requiring attention.</p>
        </div>
      </CardContent>
    </Card>
  );
}
