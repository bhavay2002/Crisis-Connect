import { db } from "../db";
import { disasterReports, disasterPredictions } from "@shared/schema";
import { sql } from "drizzle-orm";

interface HistoricalPattern {
  location: string;
  latitude: number;
  longitude: number;
  disasterType: string;
  frequency: number;
  avgSeverity: string;
  lastOccurrence: Date;
}

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  conditions: string;
  alerts?: Array<{
    event: string;
    severity: string;
    description: string;
  }>;
}

interface SeismicData {
  magnitude: number;
  depth: number;
  location: string;
  time: Date;
  distance: number;
}

interface PredictionInput {
  area: string;
  latitude: number;
  longitude: number;
  timeRange?: { from: Date; to: Date };
}

// Analyze historical disaster patterns
export async function analyzeHistoricalPatterns(
  latitude: number,
  longitude: number,
  radiusKm: number = 50
): Promise<HistoricalPattern[]> {
  try {
    const reports = await db.select().from(disasterReports);
    
    const patterns: Map<string, HistoricalPattern> = new Map();
    
    reports.forEach(report => {
      if (!report.latitude || !report.longitude) return;
      
      const reportLat = parseFloat(report.latitude);
      const reportLon = parseFloat(report.longitude);
      
      const distance = calculateDistance(
        latitude,
        longitude,
        reportLat,
        reportLon
      );
      
      if (distance <= radiusKm) {
        const key = `${report.type}-${Math.round(reportLat * 10) / 10}-${Math.round(reportLon * 10) / 10}`;
        
        if (patterns.has(key)) {
          const existing = patterns.get(key)!;
          existing.frequency++;
          if (new Date(report.createdAt) > existing.lastOccurrence) {
            existing.lastOccurrence = new Date(report.createdAt);
          }
        } else {
          patterns.set(key, {
            location: report.location,
            latitude: reportLat,
            longitude: reportLon,
            disasterType: report.type,
            frequency: 1,
            avgSeverity: report.severity,
            lastOccurrence: new Date(report.createdAt),
          });
        }
      }
    });
    
    return Array.from(patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20);
  } catch (error) {
    console.error('Error analyzing historical patterns:', error);
    return [];
  }
}

// Fetch weather data from OpenWeather API
export async function fetchWeatherData(
  latitude: number,
  longitude: number,
  apiKey?: string
): Promise<WeatherData | null> {
  if (!apiKey) {
    console.warn('OpenWeather API key not provided, using mock data');
    return {
      temperature: 25,
      humidity: 60,
      windSpeed: 10,
      precipitation: 0,
      conditions: 'clear',
    };
  }

  try {
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`;
    const alertsUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&appid=${apiKey}&exclude=minutely,hourly,daily`;
    
    const [weatherRes, alertsRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(alertsUrl).catch(() => null),
    ]);

    if (!weatherRes.ok) {
      throw new Error('Failed to fetch weather data');
    }

    const weatherData = await weatherRes.json();
    const alertsData = alertsRes?.ok ? await alertsRes.json() : null;

    return {
      temperature: weatherData.main.temp,
      humidity: weatherData.main.humidity,
      windSpeed: weatherData.wind.speed,
      precipitation: weatherData.rain?.['1h'] || 0,
      conditions: weatherData.weather[0].main.toLowerCase(),
      alerts: alertsData?.alerts?.map((alert: any) => ({
        event: alert.event,
        severity: alert.tags?.[0] || 'unknown',
        description: alert.description,
      })),
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
}

// Fetch seismic data from USGS API
export async function fetchSeismicData(
  latitude: number,
  longitude: number,
  radiusKm: number = 100
): Promise<SeismicData[]> {
  try {
    const minMagnitude = 2.5;
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${latitude}&longitude=${longitude}&maxradiuskm=${radiusKm}&minmagnitude=${minMagnitude}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch seismic data');
    }

    const data = await response.json();
    
    return data.features.map((feature: any) => ({
      magnitude: feature.properties.mag,
      depth: feature.geometry.coordinates[2],
      location: feature.properties.place,
      time: new Date(feature.properties.time),
      distance: calculateDistance(
        latitude,
        longitude,
        feature.geometry.coordinates[1],
        feature.geometry.coordinates[0]
      ),
    })).slice(0, 10);
  } catch (error) {
    console.error('Error fetching seismic data:', error);
    return [];
  }
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Generate predictions based on all data sources
export async function generatePredictions(
  input: PredictionInput,
  openWeatherApiKey?: string
): Promise<any[]> {
  const { latitude, longitude, area } = input;
  
  const [historicalPatterns, weatherData, seismicData] = await Promise.all([
    analyzeHistoricalPatterns(latitude, longitude, 50),
    fetchWeatherData(latitude, longitude, openWeatherApiKey),
    fetchSeismicData(latitude, longitude, 100),
  ]);

  const predictions: any[] = [];
  const now = new Date();
  const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Predict based on historical patterns
  for (const pattern of historicalPatterns) {
    if (pattern.frequency < 2) continue;

    let riskLevel: string = 'low';
    let confidence = 40 + (pattern.frequency * 10);
    const factors: string[] = ['historical_pattern'];

    if (pattern.frequency >= 5) {
      riskLevel = 'high';
      confidence += 20;
    } else if (pattern.frequency >= 3) {
      riskLevel = 'medium';
      confidence += 10;
    }

    predictions.push({
      disasterType: pattern.disasterType,
      predictedArea: pattern.location,
      latitude: pattern.latitude.toString(),
      longitude: pattern.longitude.toString(),
      radius: 10000,
      riskLevel,
      confidence: Math.min(confidence, 95),
      weatherData: null,
      seismicData: null,
      historicalPatterns: {
        frequency: pattern.frequency,
        lastOccurrence: pattern.lastOccurrence,
      },
      predictionFactors: factors,
      validFrom: now,
      validUntil,
      modelVersion: '1.0',
    });
  }

  // Weather-based predictions
  if (weatherData) {
    const weatherFactors: string[] = [];
    let weatherRiskLevel = 'very_low';
    let weatherConfidence = 50;

    if (weatherData.alerts && weatherData.alerts.length > 0) {
      weatherFactors.push('weather_alert');
      weatherRiskLevel = 'high';
      weatherConfidence = 80;

      for (const alert of weatherData.alerts) {
        let disasterType = 'storm';
        if (alert.event.toLowerCase().includes('flood')) {
          disasterType = 'flood';
        } else if (alert.event.toLowerCase().includes('fire')) {
          disasterType = 'fire';
        }

        predictions.push({
          disasterType,
          predictedArea: area,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          radius: 20000,
          riskLevel: 'very_high',
          confidence: 85,
          weatherData: {
            alert: alert.event,
            description: alert.description,
          },
          seismicData: null,
          historicalPatterns: null,
          predictionFactors: ['weather_alert', 'current_conditions'],
          validFrom: now,
          validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          modelVersion: '1.0',
        });
      }
    }

    if (weatherData.conditions === 'rain' && weatherData.precipitation > 50) {
      weatherFactors.push('heavy_precipitation');
      predictions.push({
        disasterType: 'flood',
        predictedArea: area,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        radius: 15000,
        riskLevel: 'medium',
        confidence: 65,
        weatherData: {
          precipitation: weatherData.precipitation,
          conditions: weatherData.conditions,
        },
        seismicData: null,
        historicalPatterns: null,
        predictionFactors: weatherFactors,
        validFrom: now,
        validUntil,
        modelVersion: '1.0',
      });
    }

    if (weatherData.windSpeed > 20) {
      weatherFactors.push('high_wind_speed');
      predictions.push({
        disasterType: 'storm',
        predictedArea: area,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        radius: 25000,
        riskLevel: 'medium',
        confidence: 60,
        weatherData: {
          windSpeed: weatherData.windSpeed,
        },
        seismicData: null,
        historicalPatterns: null,
        predictionFactors: weatherFactors,
        validFrom: now,
        validUntil,
        modelVersion: '1.0',
      });
    }
  }

  // Seismic-based predictions
  if (seismicData && seismicData.length > 0) {
    const recentQuakes = seismicData.filter(
      quake => new Date().getTime() - quake.time.getTime() < 7 * 24 * 60 * 60 * 1000
    );

    if (recentQuakes.length > 0) {
      const maxMagnitude = Math.max(...recentQuakes.map(q => q.magnitude));
      let riskLevel = 'low';
      let confidence = 55;

      if (maxMagnitude >= 5.0) {
        riskLevel = 'very_high';
        confidence = 85;
      } else if (maxMagnitude >= 4.0) {
        riskLevel = 'high';
        confidence = 75;
      } else if (maxMagnitude >= 3.0) {
        riskLevel = 'medium';
        confidence = 65;
      }

      predictions.push({
        disasterType: 'earthquake',
        predictedArea: area,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        radius: 30000,
        riskLevel,
        confidence,
        weatherData: null,
        seismicData: {
          recentQuakes: recentQuakes.length,
          maxMagnitude,
          closestDistance: Math.min(...recentQuakes.map(q => q.distance)),
        },
        historicalPatterns: null,
        predictionFactors: ['seismic_activity', 'recent_earthquakes'],
        validFrom: now,
        validUntil,
        modelVersion: '1.0',
      });
    }
  }

  return predictions;
}
