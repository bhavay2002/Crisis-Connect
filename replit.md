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
-   **Interactive Map**: Advanced Leaflet-based visualization with:
    -   **Color-coded Markers**: Severity-based color coding (green=low, yellow=medium, orange=high, red=critical)
    -   **Heatmap Layer**: Toggle-able density visualization using leaflet.heat with intensity based on severity
    -   **Layer Overlays**: Demo overlays for shelters (blue circles), evacuation zones (red polygons), and major roads (gray circles)
    -   **Timeline Playback**: Interactive timeline control with play/pause, step controls, speed adjustment (1x/2x/4x), and date slider for visualizing disaster evolution over time
    -   **Filter Controls**: Type, severity, and time range filters with real-time updates
    -   **Detailed Reports**: Clickable markers with popup previews and full detail sheets including AI validation scores and media
    -   Support for 13 disaster types: fire, flood, earthquake, storm, road accident, epidemic, landslide, gas leak, building collapse, chemical spill, power outage, water contamination, and other
-   **Report Submission**: Multi-step form for emergency type (13 categories), severity selection, automatic GPS capture, multi-media upload (photos/videos/voice recordings up to 5 minutes via MediaRecorder API), object storage integration (Uppy to S3-compatible storage), and AI validation for legitimacy detection.
-   **Resource Request System**: Allows victims to request resources (food, water, shelter, medical, etc.) with urgency and location. Includes real-time updates and status tracking.
-   **Aid Offers System**: Enables volunteers to list available resources with GPS for proximity matching. Features an AI-powered matching interface for resource requests, commitment functionality, and status tracking.
-   **Notification System**: Comprehensive real-time notification system with:
    -   Real-time WebSocket delivery for instant alerts
    -   Priority-based notifications (critical, high, medium, low)
    -   Notification types: disaster_nearby, disaster_assigned, sos_alert_nearby, resource_request_created, resource_request_fulfilled, report_confirmed, report_disputed, volunteer_assigned, ngo_assigned, status_update
    -   NotificationBell component with badge count and dropdown
    -   Full notifications page with all/unread tabs
    -   User preferences page for customizing alert settings
    -   Mark as read/unread and delete functionality
    -   Action URLs for quick navigation to relevant content
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
-   **Disaster Reports**: Type (13 categories including epidemic, road_accident, landslide, gas_leak, building_collapse, chemical_spill, power_outage, water_contamination), severity, status, location, GPS coordinates, media URLs (photos/videos/audio), AI validation score, reporter ID, verification count, timestamps.
-   **Verifications**: Links users to reports to prevent duplicate votes.
-   **Resource Requests**: Type, urgency, status, quantity, description, location, GPS, requester ID, fulfillment tracking.
-   **Aid Offers**: Type, status, quantity, description, location, GPS, offer creator ID, matching tracking.
-   **Notifications**: Type, priority, title, message, action URL, user ID, read status, creation and read timestamps, metadata.
-   **Notification Preferences**: User ID with boolean toggles for each notification type to customize alert settings.
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
-   **Third-party NPM Packages**: Radix UI, TanStack Query, Wouter, Drizzle ORM, Zod, date-fns, lucide-react, Leaflet, leaflet.heat (heatmap visualization), Uppy (file uploads), MediaRecorder API (voice recording).

## Recent Updates (October 30, 2025)

### Report Verification System (Latest)
- **Community Trust Rating**: Users can upvote or downvote disaster reports to indicate trust/reliability
- **Consensus Scoring Algorithm**: Combines community votes (±5 points per net vote), verifications (+10 points each, max 50), AI validation (0-20 points), and NGO/official confirmation (+30 bonus) to generate a 0-100 consensus score
- **Trust Badges**: Visual indicators showing trust levels:
  - Highly Trusted (80-100): Green badge with shield check icon
  - Trusted (60-79): Blue badge with shield icon
  - Moderate (40-59): Yellow badge with shield icon
  - Low Trust (20-39): Orange badge with shield alert icon
  - Unverified (0-19): Red badge with warning icon
- **Vote Management**: Users can cast upvote or downvote (or change/remove their vote), cannot vote on own reports
- **Real-time Updates**: Vote changes broadcast to all connected clients via WebSocket
- **Database Schema**: New `report_votes` table tracking user votes per report, added `upvotes`, `downvotes`, and `consensusScore` fields to disaster reports

### Enhanced Map Visualization
- Added heatmap layer using leaflet.heat for report density visualization with severity-weighted intensity
- Implemented layer control panel for toggling shelters, evacuation zones, and major roads overlays
- Created timeline playback component with date slider, play/pause controls, variable speed (1x/2x/4x), and step-by-step navigation
- Expanded disaster categories from 6 to 13 types including epidemics, road accidents, landslides, gas leaks, building collapses, chemical spills, power outages, and water contamination
- Added voice recording capability for incident reports using MediaRecorder API with 5-minute maximum duration and playback preview

### Technical Implementation
- New components: `VotingControls.tsx`, `TrustBadge.tsx`, `HeatmapLayer.tsx`, `TimelineControl.tsx`, `LayerControl.tsx`, `VoiceRecorder.tsx`
- Enhanced Map.tsx with conditional rendering based on layer toggles and timeline state
- Timeline filtering uses date-fns for interval calculations and real-time report filtering
- Heatmap intensity calculation based on severity levels (critical=1.0, high=0.7, medium=0.5, low=0.3)
- Consensus scoring uses weighted algorithm to prevent gaming and ensure reliability
- Vote operations include rate limiting via existing verification limiter
- Demo overlay data included for shelters, evacuation zones, and major roads (production requires real data sources)