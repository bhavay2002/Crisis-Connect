import { z } from "zod";

/**
 * Environment variable validation schema
 * All required environment variables should be defined here
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  
  // Server configuration
  PORT: z.string().default("5000"),
  
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  
  // Session
  SESSION_SECRET: z.string().optional(),
  
  // Encryption
  ENCRYPTION_KEY: z.string().optional(),
  
  // Replit Auth
  ISSUER_URL: z.string().url().optional(),
  CLIENT_ID: z.string().optional(),
  CLIENT_SECRET: z.string().optional(),
  
  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  
  // Object Storage
  REPLIT_OBJECT_STORAGE_URL: z.string().url().optional(),
  REPLIT_OBJECT_STORAGE_ACCESS_KEY_ID: z.string().optional(),
  REPLIT_OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  
  // External APIs
  OPENWEATHER_API_KEY: z.string().optional(),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().default("900000"), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().default("100"),
  
  // Pagination
  DEFAULT_PAGE_SIZE: z.string().default("20"),
  MAX_PAGE_SIZE: z.string().default("100"),
});

/**
 * Validated environment variables
 */
type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 */
function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error("❌ Invalid environment variables:");
    console.error(error);
    throw new Error("Environment validation failed");
  }
}

// Validate on import
const env = validateEnv();

/**
 * Application configuration
 * Provides type-safe access to all configuration values
 */
export const config = {
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === "development",
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  
  server: {
    port: parseInt(env.PORT, 10),
  },
  
  database: {
    url: env.DATABASE_URL,
  },
  
  session: {
    secret: env.SESSION_SECRET || "dev-session-secret-change-in-production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    secure: env.NODE_ENV === "production",
  },
  
  encryption: {
    key: env.ENCRYPTION_KEY,
  },
  
  auth: {
    issuerUrl: env.ISSUER_URL,
    clientId: env.CLIENT_ID,
    clientSecret: env.CLIENT_SECRET,
  },
  
  openai: {
    apiKey: env.OPENAI_API_KEY,
    enabled: !!env.OPENAI_API_KEY,
  },
  
  objectStorage: {
    url: env.REPLIT_OBJECT_STORAGE_URL,
    accessKeyId: env.REPLIT_OBJECT_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.REPLIT_OBJECT_STORAGE_SECRET_ACCESS_KEY,
    enabled: !!(
      env.REPLIT_OBJECT_STORAGE_URL &&
      env.REPLIT_OBJECT_STORAGE_ACCESS_KEY_ID &&
      env.REPLIT_OBJECT_STORAGE_SECRET_ACCESS_KEY
    ),
  },
  
  externalApis: {
    openWeather: {
      apiKey: env.OPENWEATHER_API_KEY,
      enabled: !!env.OPENWEATHER_API_KEY,
    },
  },
  
  rateLimit: {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
  },
  
  pagination: {
    defaultPageSize: parseInt(env.DEFAULT_PAGE_SIZE, 10),
    maxPageSize: parseInt(env.MAX_PAGE_SIZE, 10),
  },
  
  /**
   * Get a configuration value with runtime validation
   */
  get<K extends keyof Env>(key: K): Env[K] {
    return env[key];
  },
  
  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: "openai" | "objectStorage" | "openWeather"): boolean {
    switch (feature) {
      case "openai":
        return this.openai.enabled;
      case "objectStorage":
        return this.objectStorage.enabled;
      case "openWeather":
        return this.externalApis.openWeather.enabled;
      default:
        return false;
    }
  },
} as const;

/**
 * Log configuration on startup (without sensitive values)
 */
export function logConfiguration(): void {
  console.log("📋 Application Configuration:");
  console.log(`  Environment: ${config.env}`);
  console.log(`  Port: ${config.server.port}`);
  console.log(`  Database: ${config.database.url ? "✅ Configured" : "❌ Missing"}`);
  console.log(`  OpenAI: ${config.openai.enabled ? "✅ Enabled" : "⚠️  Disabled"}`);
  console.log(`  Object Storage: ${config.objectStorage.enabled ? "✅ Enabled" : "⚠️  Disabled"}`);
  console.log(`  Session Secret: ${config.session.secret !== "dev-session-secret-change-in-production" ? "✅ Custom" : "⚠️  Default (dev only)"}`);
}
