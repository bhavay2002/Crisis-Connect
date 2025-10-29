import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BarChart3, MapPin, Clock, Users, TrendingUp, AlertTriangle, CheckCircle, Package, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

interface AnalyticsSummary {
  totalEvents: number;
  reportSubmitted: number;
  reportVerified: number;
  reportResolved: number;
  resourceRequested: number;
  resourceFulfilled: number;
  aidOffered: number;
  aidDelivered: number;
  avgResponseTime: number;
}

// Utility function to convert data to CSV
function convertToCSV(data: any[], headers: string[]): string {
  const csvRows = [];
  csvRows.push(headers.join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') 
        ? `"${value}"` 
        : value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// Utility function to download data as file
function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export default function AnalyticsDashboard() {
  const { data: summary } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary"],
  });

  const { data: disasterFrequency } = useQuery<Record<string, number>>({
    queryKey: ["/api/analytics/disaster-frequency"],
  });

  const { data: geographicData } = useQuery<Array<{
    id: string;
    type: string;
    severity: string;
    location: string;
    latitude: number;
    longitude: number;
    status: string;
  }>>({
    queryKey: ["/api/analytics/geographic-impact"],
  });

  const { data: reports = [] } = useQuery<Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
  }>>({
    queryKey: ["/api/reports"],
  });

  const frequencyChartData = disasterFrequency 
    ? Object.entries(disasterFrequency).map(([type, count]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        count,
      }))
    : [];

  const severityData = reports.reduce((acc: Record<string, number>, r: any) => {
    acc[r.severity] = (acc[r.severity] || 0) + 1;
    return acc;
  }, {});

  const severityChartData = Object.entries(severityData).map(([severity, count]) => ({
    name: severity.charAt(0).toUpperCase() + severity.slice(1),
    value: count,
  }));

  const statusData = reports.reduce((acc: Record<string, number>, r: any) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const statusChartData = Object.entries(statusData).map(([status, count]) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1),
    count,
  }));

  const heatmapData = geographicData?.reduce((acc: Record<string, number>, point) => {
    const key = `${Math.round(point.latitude * 10) / 10},${Math.round(point.longitude * 10) / 10}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}) || {};

  const topHotspots = Object.entries(heatmapData)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([coords, count]) => ({
      coordinates: coords,
      incidents: count,
    }));

  const responseTime = summary?.avgResponseTime 
    ? Math.round(summary.avgResponseTime / 60000)
    : 0;

  // Export handlers
  const handleExportCSV = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Build comprehensive CSV with multiple sections
    let csvContent = '';
    
    // Section 1: Summary Metrics
    csvContent += 'SUMMARY METRICS\n';
    csvContent += 'Metric,Value,Period\n';
    csvContent += `Total Reports Submitted,${summary?.reportSubmitted || 0},Last 30 days\n`;
    csvContent += `Reports Verified,${summary?.reportVerified || 0},Last 30 days\n`;
    csvContent += `Reports Resolved,${summary?.reportResolved || 0},Last 30 days\n`;
    csvContent += `Resource Requests,${summary?.resourceRequested || 0},Last 30 days\n`;
    csvContent += `Resources Fulfilled,${summary?.resourceFulfilled || 0},Last 30 days\n`;
    csvContent += `Aid Offered,${summary?.aidOffered || 0},Last 30 days\n`;
    csvContent += `Aid Delivered,${summary?.aidDelivered || 0},Last 30 days\n`;
    csvContent += `Average Response Time (minutes),${responseTime},Last 30 days\n`;
    csvContent += '\n';
    
    // Section 2: Disaster Frequency
    csvContent += 'DISASTER FREQUENCY BY TYPE\n';
    csvContent += 'Disaster Type,Count\n';
    if (disasterFrequency && Object.keys(disasterFrequency).length > 0) {
      Object.entries(disasterFrequency).forEach(([type, count]) => {
        csvContent += `${type.charAt(0).toUpperCase() + type.slice(1)},${count}\n`;
      });
    } else {
      csvContent += 'No data available\n';
    }
    csvContent += '\n';
    
    // Section 3: Reports by Severity
    csvContent += 'REPORTS BY SEVERITY\n';
    csvContent += 'Severity Level,Count\n';
    if (Object.keys(severityData).length > 0) {
      Object.entries(severityData).forEach(([severity, count]) => {
        csvContent += `${severity.charAt(0).toUpperCase() + severity.slice(1)},${count}\n`;
      });
    } else {
      csvContent += 'No data available\n';
    }
    csvContent += '\n';
    
    // Section 4: Reports by Status
    csvContent += 'REPORTS BY STATUS\n';
    csvContent += 'Status,Count\n';
    if (Object.keys(statusData).length > 0) {
      Object.entries(statusData).forEach(([status, count]) => {
        csvContent += `${status.charAt(0).toUpperCase() + status.slice(1)},${count}\n`;
      });
    } else {
      csvContent += 'No data available\n';
    }
    csvContent += '\n';
    
    // Section 5: Top Incident Hotspots
    csvContent += 'TOP INCIDENT HOTSPOTS\n';
    csvContent += 'Coordinates (Lat,Lon),Number of Incidents\n';
    if (topHotspots.length > 0) {
      topHotspots.forEach(({ coordinates, incidents }) => {
        csvContent += `"${coordinates}",${incidents}\n`;
      });
    } else {
      csvContent += 'No data available\n';
    }
    
    downloadFile(csvContent, `crisis-connect-analytics-${timestamp}.csv`, 'text/csv');
  };

  const handleExportJSON = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Prepare comprehensive report data
    const reportData = {
      generatedAt: new Date().toISOString(),
      period: 'Last 30 days',
      summary: {
        totalReports: summary?.reportSubmitted || 0,
        verifiedReports: summary?.reportVerified || 0,
        resolvedReports: summary?.reportResolved || 0,
        resourceRequests: summary?.resourceRequested || 0,
        resourcesFulfilled: summary?.resourceFulfilled || 0,
        aidOffered: summary?.aidOffered || 0,
        aidDelivered: summary?.aidDelivered || 0,
        averageResponseTimeMinutes: responseTime
      },
      disasterFrequency: disasterFrequency,
      reportsBySeverity: severityData,
      reportsByStatus: statusData,
      topIncidentHotspots: topHotspots
    };

    const json = JSON.stringify(reportData, null, 2);
    downloadFile(json, `crisis-connect-analytics-${timestamp}.json`, 'application/json');
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Comprehensive insights and performance metrics</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-export">
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV} data-testid="menu-item-export-csv">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Download as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON} data-testid="menu-item-export-json">
                <FileJson className="w-4 h-4 mr-2" />
                Download as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-reports">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-reports">
                {summary?.reportSubmitted || 0}
              </div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card data-testid="card-verified-reports">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified Reports</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-verified-reports">
                {summary?.reportVerified || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary?.reportSubmitted 
                  ? `${Math.round((summary.reportVerified / summary.reportSubmitted) * 100)}% verification rate`
                  : "No data"}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-resolved-reports">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-resolved-reports">
                {summary?.reportResolved || 0}
              </div>
              <p className="text-xs text-muted-foreground">Cases closed</p>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-response-time">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-response-time">
                {responseTime}m
              </div>
              <p className="text-xs text-muted-foreground">Minutes to first response</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="disasters" className="w-full">
          <TabsList>
            <TabsTrigger value="disasters" data-testid="tab-disasters">
              <BarChart3 className="mr-2 h-4 w-4" />
              Disaster Analysis
            </TabsTrigger>
            <TabsTrigger value="geographic" data-testid="tab-geographic">
              <MapPin className="mr-2 h-4 w-4" />
              Geographic Impact
            </TabsTrigger>
            <TabsTrigger value="resources" data-testid="tab-resources">
              <Package className="mr-2 h-4 w-4" />
              Resource Metrics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="disasters" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card data-testid="card-disaster-frequency">
                <CardHeader>
                  <CardTitle>Disaster Frequency by Type</CardTitle>
                  <CardDescription>Distribution of reported disasters</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={frequencyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card data-testid="card-severity-distribution">
                <CardHeader>
                  <CardTitle>Severity Distribution</CardTitle>
                  <CardDescription>Reports categorized by severity level</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={severityChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => entry.name}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {severityChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-status-progression">
              <CardHeader>
                <CardTitle>Report Status Progression</CardTitle>
                <CardDescription>Current state of all reports</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={statusChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="status" type="category" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="geographic" className="space-y-4">
            <Card data-testid="card-geographic-heatmap">
              <CardHeader>
                <CardTitle>Geographic Impact Heatmap</CardTitle>
                <CardDescription>Top disaster hotspots by location</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topHotspots.map((hotspot, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`hotspot-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">Coordinates: {hotspot.coordinates}</p>
                          <p className="text-sm text-muted-foreground">
                            {hotspot.incidents} incident{hotspot.incidents !== 1 ? 's' : ''} reported
                          </p>
                        </div>
                      </div>
                      <div className={`h-2 ${
                        hotspot.incidents > 5 ? 'w-32 bg-red-500' :
                        hotspot.incidents > 3 ? 'w-24 bg-orange-500' :
                        'w-16 bg-yellow-500'
                      } rounded-full`} />
                    </div>
                  ))}
                  {topHotspots.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No geographic data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-incidents-by-severity">
              <CardHeader>
                <CardTitle>Geographic Incidents by Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  {['low', 'medium', 'high', 'critical'].map((severity) => {
                    const count = geographicData?.filter(d => d.severity === severity).length || 0;
                    return (
                      <div key={severity} className="p-4 border rounded-lg" data-testid={`severity-card-${severity}`}>
                        <p className="text-sm font-medium capitalize text-muted-foreground">{severity}</p>
                        <p className="text-2xl font-bold">{count}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card data-testid="card-resource-requests">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Resource Requests</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-resource-requests">
                    {summary?.resourceRequested || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Total requests submitted</p>
                </CardContent>
              </Card>

              <Card data-testid="card-resources-fulfilled">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Fulfilled</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="text-resources-fulfilled">
                    {summary?.resourceFulfilled || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {summary?.resourceRequested 
                      ? `${Math.round((summary.resourceFulfilled / summary.resourceRequested) * 100)}% fulfillment rate`
                      : "No data"}
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-aid-delivered">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aid Delivered</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600" data-testid="text-aid-delivered">
                    {summary?.aidDelivered || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">From {summary?.aidOffered || 0} offers</p>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-performance-metrics">
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>System efficiency indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between" data-testid="metric-verification-rate">
                    <div>
                      <p className="font-medium">Verification Rate</p>
                      <p className="text-sm text-muted-foreground">Percentage of reports verified</p>
                    </div>
                    <div className="text-2xl font-bold">
                      {summary?.reportSubmitted 
                        ? `${Math.round((summary.reportVerified / summary.reportSubmitted) * 100)}%`
                        : "0%"}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between" data-testid="metric-resolution-rate">
                    <div>
                      <p className="font-medium">Resolution Rate</p>
                      <p className="text-sm text-muted-foreground">Percentage of reports resolved</p>
                    </div>
                    <div className="text-2xl font-bold">
                      {summary?.reportSubmitted 
                        ? `${Math.round((summary.reportResolved / summary.reportSubmitted) * 100)}%`
                        : "0%"}
                    </div>
                  </div>

                  <div className="flex items-center justify-between" data-testid="metric-resource-fulfillment">
                    <div>
                      <p className="font-medium">Resource Fulfillment</p>
                      <p className="text-sm text-muted-foreground">Percentage of requests fulfilled</p>
                    </div>
                    <div className="text-2xl font-bold">
                      {summary?.resourceRequested 
                        ? `${Math.round((summary.resourceFulfilled / summary.resourceRequested) * 100)}%`
                        : "0%"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
