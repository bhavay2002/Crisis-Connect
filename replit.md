# Crisis Connect - Real-Time Disaster Management Platform

## Overview

Crisis Connect is a real-time disaster management and emergency response coordination platform. Its core purpose is to facilitate rapid incident reporting with GPS tracking and media, enable crowd-sourced verification of reports, and coordinate emergency response efforts. The platform uses AI for validation, automatically detecting duplicate and potentially fake reports. It is designed with a mobile-first approach, prioritizing speed and clarity crucial for emergency situations, aiming to improve data quality and streamline relief operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite.
**UI/UX**: shadcn/ui (Radix UI + Tailwind CSS) following an Emergency Services Design Pattern with Material Design influences. Emphasizes clarity, speed, and mobile-first accessibility.
**Design System**: Inter font for text, JetBrains Mono for technical data, HSL-based color system with light/dark themes, custom border radius and Tailwind spacing.
**State Management**: TanStack Query for server state.
**Routing**: Wouter for client-side routing with authentication protection.
**Real-time Updates**: Custom `useWebSocket` hook for live updates.

**Key Features**:
-   **Dashboard**: Statistics, active reports with filtering.
-   **Volunteer Hub**: Comprehensive dashboard for volunteers/NGOs with demand-supply overview, pending resource requests, aid offer management, and report verification queue. Includes real-time metrics and AI-powered insights.
-   **Admin Dashboard**: Admin-only control panel with three key modules:
    -   **User Management**: View all users, assign roles (Citizen, Volunteer, NGO, Admin) with security controls preventing self-demotion and unauthorized admin provisioning.
    -   **Report Moderation**: Enhanced verification interface with flagging (false report, duplicate, spam), report assignment to volunteers, admin notes, and status controls for managing disaster reports.
    -   **Analytics Export**: Generate comprehensive government reports in CSV or JSON format including summary metrics, disaster frequency by type, severity/status breakdowns, and incident hotspots.
-   **Interactive Map**: Leaflet with OpenStreetMap, color-coded severity markers, filtering, clickable report previews, detailed report view with AI validation score and media.
-   **Report Submission**: Multi-step form for emergency type, severity, GPS capture, photo/video upload (Uppy to S3-compatible storage), AI validation for legitimacy.
-   **Resource Request System**: Allows victims to request resources (food, water, shelter, medical, etc.) with urgency and location. Includes real-time updates and status tracking.
-   **Aid Offers System**: Enables volunteers to list available resources with GPS for proximity matching. Features an AI-powered matching interface for resource requests, commitment functionality, and status tracking.
-   Real-time notifications via toast messages.
-   Responsive sidebar navigation with role-based menu items.

### Backend Architecture

**Framework**: Express.js with TypeScript on Node.js.
**API Design**: RESTful API for reports, resource requests, aid offers, authentication, and media uploads.
**WebSocket Server**: Integrated for real-time notifications.
**Session Management**: Express sessions with PostgreSQL store.
**Middleware**: JSON body parsing, request logging, secure session management, Passport.js for authentication.

### Database Architecture

**ORM**: Drizzle ORM with PostgreSQL (Neon serverless driver).
**Schema**:
-   **Sessions**: For Replit Auth.
-   **Users**: From Replit Auth (email, name, image, UUID).
-   **Disaster Reports**: Type, severity, status, location, GPS, media URLs, AI validation score, reporter ID, verification count.
-   **Verifications**: Links users to reports to prevent duplicate votes.
-   **Resource Requests**: Type, urgency, status, quantity, description, location, GPS, requester ID, fulfillment tracking.
-   **Aid Offers**: Type, status, quantity, description, location, GPS, offer creator ID, matching tracking.
**Indexes**: On session expiration.
**Migrations**: Drizzle Kit.

### Authentication & Authorization

**Provider**: Replit Auth (OpenID Connect).
**Implementation**: Passport.js, session-based authentication, `isAuthenticated` middleware.
**Role-Based Access Control**:
-   Four roles: Citizen, Volunteer, NGO, Admin.
-   Role selection page, `requireRole` middleware for endpoint protection.
-   Security controls: Admin provisioning via database, prevents self-demotion, server-side validation.
**Security**: HTTPS-only cookies, CSRF protection.

## External Dependencies

-   **Authentication Service**: Replit OIDC provider (`ISSUER_URL`).
-   **Database**: PostgreSQL via Neon serverless (`DATABASE_URL`).
-   **OpenAI Service**: Replit AI Integrations (GPT-4o-mini) for report validation and resource matching.
-   **Object Storage**: Replit App Storage for secure media uploads and access control.
-   **Google Fonts**: Inter and JetBrains Mono fonts.
-   **Third-party NPM Packages**: Radix UI, TanStack Query, Wouter, Drizzle ORM, Zod, date-fns, lucide-react.