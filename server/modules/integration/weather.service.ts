import { db } from "../../db/db";
import { weatherData } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { getCircuitBreaker } from "../resilience/circuit-breaker";
import { withRetry } from "../resilience/retry";
import { logger } from "../../utils/logger";

const cb = getCircuitBreaker("weather-openmeteo", { failureThreshold: 3, timeout: 120_000 });

const WMO_CODES: Record<number, { description: string; alertLevel: "none" | "watch" | "warning" | "emergency" }> = {
  0:  { description: "Clear sky",              alertLevel: "none"      },
  1:  { description: "Mainly clear",           alertLevel: "none"      },
  2:  { description: "Partly cloudy",          alertLevel: "none"      },
  3:  { description: "Overcast",               alertLevel: "none"      },
  45: { description: "Foggy",                  alertLevel: "watch"     },
  48: { description: "Rime fog",               alertLevel: "watch"     },
  51: { description: "Light drizzle",          alertLevel: "none"      },
  61: { description: "Slight rain",            alertLevel: "none"      },
  63: { description: "Moderate rain",          alertLevel: "watch"     },
  65: { description: "Heavy rain",             alertLevel: "warning"   },
  71: { description: "Slight snowfall",        alertLevel: "watch"     },
  75: { description: "Heavy snowfall",         alertLevel: "warning"   },
  80: { description: "Slight rain showers",    alertLevel: "none"      },
  82: { description: "Violent rain showers",   alertLevel: "emergency" },
  95: { description: "Thunderstorm",           alertLevel: "warning"   },
  96: { description: "Thunderstorm w/ hail",   alertLevel: "emergency" },
  99: { description: "Heavy thunderstorm",     alertLevel: "emergency" },
};

function calcRiskScore(code: number, rainfall: number, windSpeed: number): number {
  const alert = WMO_CODES[code]?.alertLevel ?? "none";
  let base = ({ none: 0, watch: 25, warning: 55, emergency: 85 })[alert];
  if (rainfall > 10) base += 10;
  if (rainfall > 50) base += 15;
  if (windSpeed > 50) base += 10;
  if (windSpeed > 90) base += 15;
  return Math.min(base, 100);
}

export async function fetchWeather(lat: string, lng: string, region = "Unknown"): Promise<typeof weatherData.$inferSelect> {
  const fallbackRecord = async () => {
    const [row] = await db.insert(weatherData).values({
      region, latitude: lat, longitude: lng,
      temperature: "25", rainfall: "0", windSpeed: "10",
      humidity: "60", weatherCode: 0, alertLevel: "none", riskScore: 0,
      rawData: { source: "fallback" },
    }).returning();
    return row;
  };

  return cb.execute<typeof weatherData.$inferSelect>(async () => {
    return withRetry<typeof weatherData.$inferSelect>(async () => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
      const data = await res.json();
      const c = data.current || {};
      const code = c.weather_code ?? 0;
      const rainfall = parseFloat(c.precipitation ?? "0");
      const windSpeed = parseFloat(c.wind_speed_10m ?? "0");
      const alert = WMO_CODES[code]?.alertLevel ?? "none";
      const riskScore = calcRiskScore(code, rainfall, windSpeed);

      logger.info(`[Weather] Fetched for ${region} (${lat},${lng}): code=${code}, risk=${riskScore}`);

      const [row] = await db.insert(weatherData).values({
        region, latitude: lat, longitude: lng,
        temperature: String(c.temperature_2m ?? ""),
        rainfall: String(rainfall),
        windSpeed: String(windSpeed),
        humidity: String(c.relative_humidity_2m ?? ""),
        weatherCode: code,
        alertLevel: alert,
        riskScore,
        rawData: data,
      }).returning();
      return row;
    }, { attempts: 2, baseDelayMs: 500 });
  }, fallbackRecord);
}

export async function getLatestWeather(region: string) {
  const [row] = await db.select().from(weatherData)
    .where(eq(weatherData.region, region))
    .orderBy(desc(weatherData.fetchedAt))
    .limit(1);
  return row ?? null;
}

export async function getAllRegionWeather() {
  return db.select().from(weatherData).orderBy(desc(weatherData.fetchedAt)).limit(50);
}

export function getWeatherDescription(code: number) {
  return WMO_CODES[code] ?? { description: "Unknown", alertLevel: "none" };
}
