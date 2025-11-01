import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MapContainer, TileLayer, Circle, Popup, Marker } from 'react-leaflet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Brain, CloudRain, Activity, AlertTriangle, MapPin } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const RISK_LEVEL_COLORS: Record<string, string> = {
  very_low: '#22c55e',
  low: '#84cc16',
  medium: '#f59e0b',
  high: '#ef4444',
  very_high: '#dc2626',
};

const RISK_LEVEL_LABELS: Record<string, string> = {
  very_low: 'Very Low',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  very_high: 'Very High',
};

const DISASTER_TYPE_LABELS: Record<string, string> = {
  fire: 'Fire',
  flood: 'Flood',
  earthquake: 'Earthquake',
  storm: 'Storm',
  road_accident: 'Road Accident',
  epidemic: 'Epidemic',
  landslide: 'Landslide',
  gas_leak: 'Gas Leak',
  building_collapse: 'Building Collapse',
  chemical_spill: 'Chemical Spill',
  power_outage: 'Power Outage',
  water_contamination: 'Water Contamination',
  other: 'Other',
};

export default function PredictiveModeling() {
  const { toast } = useToast();
  const [generatingLocation, setGeneratingLocation] = useState({ area: '', latitude: '', longitude: '' });
  
  const { data: predictions, isLoading } = useQuery({
    queryKey: ['/api/predictions'],
  });

  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { area: string; latitude: string; longitude: string }) => {
      return await apiRequest('POST', '/api/predictions/generate', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/predictions'] });
      toast({
        title: 'Success',
        description: 'Predictions generated successfully',
      });
      setGeneratingLocation({ area: '', latitude: '', longitude: '' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate predictions',
        variant: 'destructive',
      });
    },
  });

  const handleGetCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeneratingLocation(prev => ({
            ...prev,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          }));
        },
        (error) => {
          toast({
            title: 'Error',
            description: 'Failed to get current location',
            variant: 'destructive',
          });
        }
      );
    }
  };

  const handleGeneratePredictions = () => {
    if (!generatingLocation.area || !generatingLocation.latitude || !generatingLocation.longitude) {
      toast({
        title: 'Error',
        description: 'Please provide area name, latitude, and longitude',
        variant: 'destructive',
      });
      return;
    }

    generateMutation.mutate(generatingLocation);
  };

  const canGeneratePredictions = Boolean(user && ['ngo', 'admin', 'government'].includes((user as any).role || ''));

  const defaultCenter: [number, number] = [20.5937, 78.9629]; // India center
  const defaultZoom = 5;

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Brain className="w-8 h-8" />
            Predictive Modeling
          </h1>
          <p className="text-muted-foreground">
            AI-powered disaster forecasting using historical data, weather patterns, and seismic activity
          </p>
        </div>

        {canGeneratePredictions ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Generate New Predictions</CardTitle>
              <CardDescription>
                Analyze an area to forecast potential disasters based on multiple data sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="area">Area Name</Label>
                  <Input
                    id="area"
                    placeholder="e.g., Mumbai, Maharashtra"
                    value={generatingLocation.area}
                    onChange={(e) => setGeneratingLocation(prev => ({ ...prev, area: e.target.value }))}
                    data-testid="input-area"
                  />
                </div>
                <div>
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    placeholder="19.076"
                    value={generatingLocation.latitude}
                    onChange={(e) => setGeneratingLocation(prev => ({ ...prev, latitude: e.target.value }))}
                    data-testid="input-latitude"
                  />
                </div>
                <div>
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    placeholder="72.8777"
                    value={generatingLocation.longitude}
                    onChange={(e) => setGeneratingLocation(prev => ({ ...prev, longitude: e.target.value }))}
                    data-testid="input-longitude"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleGeneratePredictions}
                  disabled={generateMutation.isPending}
                  data-testid="button-generate"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      Generate Predictions
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleGetCurrentLocation}
                  variant="outline"
                  data-testid="button-current-location"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Use Current Location
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Tabs defaultValue="map" className="space-y-4">
          <TabsList>
            <TabsTrigger value="map" data-testid="tab-map">Map View</TabsTrigger>
            <TabsTrigger value="list" data-testid="tab-list">List View</TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="h-[600px] flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : predictions && Array.isArray(predictions) && predictions.length > 0 ? (
                  <div className="h-[600px] rounded-lg overflow-hidden">
                    <MapContainer
                      center={defaultCenter}
                      zoom={defaultZoom}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      {predictions.map((prediction: any) => (
                        <Circle
                          key={prediction.id}
                          center={[parseFloat(prediction.latitude), parseFloat(prediction.longitude)]}
                          radius={prediction.radius}
                          pathOptions={{
                            color: RISK_LEVEL_COLORS[prediction.riskLevel],
                            fillColor: RISK_LEVEL_COLORS[prediction.riskLevel],
                            fillOpacity: 0.3,
                          }}
                        >
                          <Popup>
                            <div className="p-2">
                              <h3 className="font-bold mb-2">{prediction.predictedArea}</h3>
                              <div className="space-y-1 text-sm">
                                <p><strong>Type:</strong> {DISASTER_TYPE_LABELS[prediction.disasterType]}</p>
                                <p><strong>Risk Level:</strong> {RISK_LEVEL_LABELS[prediction.riskLevel]}</p>
                                <p><strong>Confidence:</strong> {prediction.confidence}%</p>
                                <p><strong>Valid Until:</strong> {new Date(prediction.validUntil).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </Popup>
                        </Circle>
                      ))}
                    </MapContainer>
                  </div>
                ) : (
                  <div className="h-[600px] flex flex-col items-center justify-center text-center p-8">
                    <AlertTriangle className="w-16 h-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Predictions Available</h3>
                    <p className="text-muted-foreground">
                      {canGeneratePredictions
                        ? 'Generate predictions for an area to see risk forecasts'
                        : 'No predictions have been generated yet'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : predictions && Array.isArray(predictions) && predictions.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {predictions.map((prediction: any) => (
                  <Card key={prediction.id} data-testid={`card-prediction-${prediction.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {DISASTER_TYPE_LABELS[prediction.disasterType]}
                            <Badge
                              style={{
                                backgroundColor: RISK_LEVEL_COLORS[prediction.riskLevel],
                                color: 'white',
                              }}
                              data-testid="badge-risk-level"
                            >
                              {RISK_LEVEL_LABELS[prediction.riskLevel]}
                            </Badge>
                          </CardTitle>
                          <CardDescription>{prediction.predictedArea}</CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold" data-testid="text-confidence">
                            {prediction.confidence}%
                          </div>
                          <div className="text-xs text-muted-foreground">Confidence</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Radius:</span>
                          <span className="ml-2 font-medium">{(prediction.radius / 1000).toFixed(1)} km</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Valid Until:</span>
                          <span className="ml-2 font-medium">
                            {new Date(prediction.validUntil).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {prediction.predictionFactors && prediction.predictionFactors.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Prediction Factors:</h4>
                          <div className="flex flex-wrap gap-2">
                            {prediction.predictionFactors.map((factor: string, index: number) => (
                              <Badge key={index} variant="outline" data-testid={`badge-factor-${index}`}>
                                {factor === 'historical_pattern' && <Activity className="w-3 h-3 mr-1" />}
                                {factor === 'weather_alert' && <CloudRain className="w-3 h-3 mr-1" />}
                                {factor === 'seismic_activity' && <Activity className="w-3 h-3 mr-1" />}
                                {factor.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {prediction.weatherData && (
                        <Alert>
                          <CloudRain className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Weather Alert:</strong>{' '}
                            {prediction.weatherData.alert || JSON.stringify(prediction.weatherData)}
                          </AlertDescription>
                        </Alert>
                      )}

                      {prediction.seismicData && (
                        <Alert>
                          <Activity className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Seismic Activity:</strong> {prediction.seismicData.recentQuakes || 0} recent earthquakes,
                            max magnitude {prediction.seismicData.maxMagnitude}
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="w-16 h-16 text-muted-foreground mb-4 mx-auto" />
                <h3 className="text-xl font-semibold mb-2">No Predictions Available</h3>
                <p className="text-muted-foreground">
                  {canGeneratePredictions
                    ? 'Generate predictions for an area to see risk forecasts'
                    : 'No predictions have been generated yet'}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
