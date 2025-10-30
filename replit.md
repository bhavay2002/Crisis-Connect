# Crisis Connect - Real-Time Disaster Management Platform

## Overview
Crisis Connect is a real-time disaster management and emergency response coordination platform. Its primary goal is to improve data quality and streamline relief operations by enabling rapid, GPS-tracked incident reporting with multimedia, facilitating crowd-sourced verification, and coordinating emergency responses. The platform leverages AI for report validation, duplicate detection, and resource matching, prioritizing a mobile-first approach for speed and clarity in emergency situations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Framework**: React with TypeScript, using Vite.
**UI/UX**: shadcn/ui (Radix UI + Tailwind CSS) with an Emergency Services Design Pattern and Material Design influences, prioritizing clarity, speed, and mobile-first accessibility.
**Design System**: Inter font, JetBrains Mono, HSL-based color system with light/dark themes.
**State Management**: TanStack Query.
**Routing**: Wouter for client-side routing with authentication protection.
**Real-time Updates**: Custom `useWebSocket` hook.

**Key Features**:
-   **Dashboards**:
    -   **Dashboard**: Statistics and active reports.
    -   **Volunteer Hub**: Comprehensive overview for volunteers/NGOs including demand-supply, resource management, report verification, and AI-powered insights.
    -   **Admin Dashboard**: User management, enhanced report moderation (flagging, assignment, notes, status controls), and analytics export (CSV/JSON).
-   **Interactive Map**: Leaflet-based visualization with color-coded markers (severity), heatmap layer (density), demo overlays (shelters, evacuation zones, roads), timeline playback, filter controls (type, severity, time), and detailed report views. Supports 13 disaster types.
-   **Report Submission**: Multi-step form for 13 emergency types, severity, automatic GPS, multi-media upload (photos/videos/voice recordings via MediaRecorder API to S3-compatible storage), and AI validation.
-   **Resource Management**: Systems for victims to request resources (Resource Request System) and volunteers to offer resources (Aid Offers System), with AI-powered matching, commitment, and status tracking.
-   **Notification System**: Real-time WebSocket-based notifications with priority levels, various types (e.g., disaster_nearby, resource_request), user preferences, and action URLs.
-   **Navigation**: Responsive sidebar with role-based menu items.
-   **Report Verification System**: Users can upvote/downvote reports. A consensus scoring algorithm combines community votes, verifications, AI validation, and NGO/official confirmation to generate a trust score (0-100) with visual trust badges.
-   **Duplicate Detection & Clustering**: Non-AI-based duplicate detection using text similarity, location proximity, and time/type matching. Automatically analyzes new reports against recent ones, provides bidirectional linking, and offers a Cluster Management UI for viewing and managing clusters.
-   **Image Classification**: Client-side AI-powered disaster type detection using TensorFlow.js and MobileNet. Users can upload images to automatically identify disaster types (fire, flood, earthquake, storm, road accident, landslide) with confidence scores. No external API keys required - runs entirely in the browser.
-   **Predictive Modeling**: AI-powered disaster forecasting system that analyzes historical patterns, real-time weather data (OpenWeather API), and seismic activity (USGS API) to predict potential affected areas. Features include risk level assessment (very low to very high), confidence scoring, map visualization with color-coded risk zones, and role-based generation (NGO/Government/Admin only).

### Backend
**Framework**: Express.js with TypeScript on Node.js.
**API Design**: RESTful API for core functionalities.
**WebSocket Server**: Integrated for real-time notifications.
**Session Management**: Express sessions with PostgreSQL store.
**Middleware**: JSON parsing, logging, secure sessions, Passport.js.

### Database
**ORM**: Drizzle ORM with PostgreSQL (Neon serverless driver).
**Schema Highlights**: Sessions, Users (from Replit Auth), Disaster Reports (with 13 types, media URLs, AI score, verification), Verifications, Resource Requests, Aid Offers, Notifications, Notification Preferences. Enhanced `disaster_reports` with `similarReportIds` for clustering.
**Indexes**: On session expiration.
**Migrations**: Drizzle Kit.

### Authentication & Authorization
**Provider**: Replit Auth (OpenID Connect).
**Implementation**: Passport.js, session-based authentication, `isAuthenticated` middleware.
**Role-Based Access Control**: Five roles (Citizen, Volunteer, NGO, Government, Admin) with `requireRole` middleware, secure admin provisioning, and server-side validation.
**Identity Verification**: Email (OTP), Phone (SMS OTP), and simulated Aadhaar verification. Verification status (`emailVerified`, `phoneVerified`, `aadhaarVerified`) tracked.
**User Reputation System**: Trust score (0-100) based on verified contributions, tracked metrics (e.g., `totalReports`, `verifiedReports`), achievement system with unlockable badges, and trust levels.

## External Dependencies
-   **Authentication Service**: Replit OIDC provider (`ISSUER_URL`).
-   **Database**: PostgreSQL via Neon serverless (`DATABASE_URL`).
-   **OpenAI Service**: Replit AI Integrations (GPT-4o-mini) for report validation and resource matching.
-   **Object Storage**: Replit App Storage for media uploads.
-   **Google Fonts**: Inter and JetBrains Mono.
-   **Third-party NPM Packages**: Radix UI, TanStack Query, Wouter, Drizzle ORM, Zod, date-fns, lucide-react, Leaflet, leaflet.heat, Uppy, MediaRecorder API.