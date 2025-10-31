# Crisis Connect - Real-Time Disaster Management Platform

## Overview
Crisis Connect is a real-time disaster management and emergency response coordination platform. Its core purpose is to enhance data quality and streamline relief operations through rapid, GPS-tracked incident reporting with multimedia, crowd-sourced verification, and coordinated emergency responses. The platform utilizes AI for report validation, duplicate detection, and resource matching, with a mobile-first design for speed and clarity in emergency situations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Framework**: React with TypeScript, using Vite.
**UI/UX**: shadcn/ui (Radix UI + Tailwind CSS) following an Emergency Services Design Pattern and Material Design principles, prioritizing clarity, speed, and mobile-first accessibility.
**Design System**: Inter font, JetBrains Mono, HSL-based color system with light/dark themes.
**State Management**: TanStack Query.
**Routing**: Wouter for client-side routing.
**Real-time Updates**: Custom `useWebSocket` hook.

**Key Features**:
-   **Dashboards**: Includes a main dashboard, Volunteer Hub (demand-supply, resource management, report verification, AI insights), and Admin Dashboard (user management, report moderation, analytics export).
-   **Interactive Map**: Leaflet-based map with color-coded markers, a high-impact heatmap, demo overlays (shelters, evacuation zones), timeline playback, and filter controls for 13 disaster types. The heatmap aggregates data from multiple sources with weighted intensity.
-   **Report Submission**: Multi-step form supporting 13 emergency types, severity, automatic GPS, multi-media upload (photos/videos/voice recordings to S3-compatible storage), and AI validation.
-   **Resource Management**: Systems for victims to request resources and volunteers to offer them, with AI-powered matching and status tracking.
-   **Notification System**: Real-time WebSocket-based notifications with priority levels and user preferences.
-   **Report Verification System**: Community upvote/downvote, consensus scoring combining votes, AI validation, and NGO/official confirmation for a trust score.
-   **Duplicate Detection & Clustering**: Non-AI-based detection using text similarity, location proximity, and time/type matching, with a Cluster Management UI.
-   **Image Classification**: Client-side AI disaster type detection using TensorFlow.js (MobileNet) for uploaded images.
-   **Predictive Modeling**: AI-powered disaster forecasting using historical patterns, real-time weather (OpenWeather API), and seismic activity (USGS API) to predict affected areas and assess risk levels.

### Backend
**Framework**: Express.js with TypeScript on Node.js.
**API Design**: RESTful API.
**WebSocket Server**: Integrated for real-time notifications.
**Session Management**: Express sessions with PostgreSQL store.
**Middleware**: JSON parsing, logging, secure sessions, Passport.js.

### Database
**ORM**: Drizzle ORM with PostgreSQL (Neon serverless driver).
**Schema Highlights**: Sessions, Users, Disaster Reports (with 13 types, media URLs, AI score, verification), Verifications, Resource Requests, Aid Offers, Notifications, Notification Preferences.
**Migrations**: Drizzle Kit.

### Authentication & Authorization
**Provider**: Replit Auth (OpenID Connect).
**Implementation**: Passport.js, session-based authentication, `isAuthenticated` middleware.
**Role-Based Access Control**: Five roles (Citizen, Volunteer, NGO, Government, Admin) with `requireRole` middleware.
**Identity Verification**: Email (OTP), Phone (SMS OTP), and simulated Aadhaar verification.
**User Reputation System**: Trust score (0-100) based on verified contributions and achievements.

### Performance Optimization
-   **Pagination System**: Standardized across API endpoints with configurable page size, metadata, sorting, and filtering.
-   **In-Memory Caching**: High-performance caching for frequently accessed data (reports, user stats, dashboard) with configurable TTL, LRU eviction, and automatic invalidation.
-   **Database Indexes**: Strategic indexes on key fields for optimized query performance.
-   **Response Compression**: Automatic gzip compression for API responses > 1KB.
-   **Cache Invalidation Strategy**: Automatic invalidation on data changes for real-time consistency.

### Security Infrastructure
-   **Secret Management**: Fail-fast validation for required environment variables (`SESSION_SECRET`, `ENCRYPTION_KEY`) in production.
-   **HTTP Security Middleware**: CORS protection, Helmet.js for security headers (CSP, HSTS, X-Content-Type-Options, Cross-Origin Policies).
-   **Rate Limiting**: Global, authentication, report submission, and AI request specific rate limits.
-   **Input Sanitization**: `express-mongo-sanitize` to prevent NoSQL injection, payload size limits.
-   **Cookie Security**: HttpOnly, Secure, SameSite=strict, MaxAge for session cookies.
-   **Input Validation**: Server-side Zod validation for all API inputs.
-   **SQL Injection Prevention**: Drizzle ORM parameterized queries.
-   **WebSocket Security**: Origin validation, session authentication, rate limiting, WSS encryption, and optional AES-GCM message encryption for sensitive types.
-   **Background Task Queue**: In-memory queue for async processing with retry logic and graceful shutdown.
-   **Shared Middleware**: Reusable authentication, validation, and authorization middleware.

## External Dependencies
-   **Authentication Service**: Replit OIDC provider.
-   **Database**: PostgreSQL via Neon serverless.
-   **AI Service**: Replit AI Integrations (GPT-4o-mini).
-   **Object Storage**: Replit App Storage for media uploads.
-   **Fonts**: Google Fonts (Inter, JetBrains Mono).
-   **Weather API**: OpenWeather API (for predictive modeling).
-   **Seismic Activity Data**: USGS API (for predictive modeling).
-   **NPM Packages**: Radix UI, TanStack Query, Wouter, Drizzle ORM, Zod, date-fns, lucide-react, Leaflet, leaflet.heat, Uppy, MediaRecorder API.