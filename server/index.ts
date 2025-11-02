import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes/index";
import { setupVite, serveStatic, log } from "./vite";
import { config, logConfiguration } from "./config";
import { logger } from "./utils/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

const app = express();

// Trust proxy - Required for rate limiting and IP detection on Replit/cloud platforms
app.set('trust proxy', true);

const isDevelopment = config.isDevelopment;

// CORS Configuration - Strict in production, permissive in development
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (isDevelopment) {
      // In development, allow localhost and Replit domains
      callback(null, true);
    } else {
      // In production, only allow specific domains
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        /\.replit\.dev$/,
        /\.repl\.co$/,
      ].filter(Boolean);
      
      const isAllowed = allowedOrigins.some(allowed => {
        if (!allowed) return false;
        if (typeof allowed === 'string') {
          return origin === allowed;
        }
        return allowed.test(origin);
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn('CORS request blocked', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
  maxAge: 86400, // Cache preflight requests for 24 hours
};

app.use(cors(corsOptions));

// Helmet.js - Security headers
if (!isDevelopment) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // No unsafe-inline or unsafe-eval for scripts - use nonces or hashes
        scriptSrc: ["'self'"],
        // For styles, we'll need to use nonces or move to external stylesheets
        // Temporarily allowing unsafe-inline for styles only (lower risk than scripts)
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "wss:", "ws:"],
        fontSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "https:", "blob:"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
  }));
} else {
  // In development, use lighter helmet configuration
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP in dev for HMR and debugging
    hsts: false, // No HSTS in development (no HTTPS)
  }));
}

// Enable gzip compression for all responses
app.use(compression({
  filter: (req: Request, res: Response) => {
    // Don't compress responses for Server-Sent Events or WebSocket upgrades
    if (req.headers['accept'] === 'text/event-stream') {
      return false;
    }
    // Use compression for everything else
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Compression level (0-9, 6 is default balance)
}));

// Cookie parser (required for CSRF protection)
app.use(cookieParser());

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// Body parsing with size limits
app.use(express.json({
  limit: '10mb', // Limit JSON payload size
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: false,
  limit: '10mb', // Limit URL-encoded payload size
}));

// Sanitize data to prevent NoSQL injection and remove $ and . from user input
app.use(mongoSanitize({
  replaceWith: '_', // Replace prohibited characters with underscore
  onSanitize: ({ req, key }) => {
    logger.warn('Request data sanitized', { 
      path: req.path,
      key,
      ip: req.ip,
    });
  },
}));

// Structured request logging
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode}`;
    const context = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: (req as any).user?.claims?.sub,
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      logger.error(message, undefined, context);
    } else if (res.statusCode >= 400) {
      logger.warn(message, context);
    } else if (req.originalUrl.startsWith("/api")) {
      logger.info(message, context);
    }
  });

  next();
});

(async () => {
  // Log configuration on startup
  logConfiguration();
  
  const server = await registerRoutes(app);

  // 404 handler for API routes - must be after API routes but before frontend catch-all
  app.use("/api", notFoundHandler);

  // Global error handler for API routes
  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = config.server.port;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    logger.info(`Server started successfully`, { port, environment: config.env });
    log(`serving on port ${port}`);
  });
})();
