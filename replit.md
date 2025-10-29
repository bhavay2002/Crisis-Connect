# Crisis Connect - Real-Time Disaster Management Platform

## Overview

Crisis Connect is a real-time disaster management and emergency response coordination platform with AI-powered validation. It enables rapid incident reporting with GPS location tracking and media uploads, crowd-sourced verification, and emergency response coordination. The platform allows users to report disasters with precise location data and photo/video evidence, verify reports from others, and coordinate relief efforts during emergencies. AI validation automatically detects duplicate and potentially fake reports to improve data quality. The application is designed with a mobile-first approach, prioritizing speed and clarity for time-sensitive emergency situations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool and development server.

**UI Component Library**: shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling. The design follows an Emergency Services Design Pattern with Material Design influences, emphasizing clarity, speed, and mobile-first accessibility.

**Design System**: 
- Typography uses Inter font for primary text and JetBrains Mono for timestamps/coordinates
- Color system based on HSL with support for light/dark themes
- Custom border radius (9px/6px/3px) and spacing units (Tailwind scale)
- "New York" style variant from shadcn/ui

**State Management**: TanStack Query (React Query) for server state with custom query client configuration. The query client is configured with infinite stale time and disabled refetch behaviors for optimal performance.

**Routing**: Wouter for client-side routing with authentication-based route protection.

**Real-time Updates**: WebSocket connection for live disaster report updates, using a custom `useWebSocket` hook that handles reconnection and message broadcasting.

**Key Features**:
- Dashboard with statistics cards showing active reports, verified incidents, and response metrics
- Active reports listing with filtering by severity and status
- **Interactive Map Dashboard**: Real-time disaster visualization with:
  - Leaflet-powered interactive map with OpenStreetMap tiles
  - Color-coded markers by severity (low=green, medium=yellow, high=orange, critical=red)
  - Filtering by disaster type, severity, and time range (1h, 24h, 7d, 30d)
  - Clickable markers with report preview popups
  - Detailed report view sheet with GPS coordinates, AI validation score, media gallery
  - Auto-centering on filtered reports or default to San Francisco
  - Graceful handling of missing/invalid GPS coordinates
- Report submission with multi-step form wizard including:
  - Emergency type and severity selection
  - GPS location capture using browser Geolocation API with auto-capture and manual trigger
  - Photo/video upload using Uppy with S3-compatible storage (max 5 files, 10MB each)
  - Review step showing all entered information before submission
  - AI validation automatically scores reports for duplicate detection and legitimacy
- **Resource Request System**: Victims can request specific supplies and resources:
  - Submit requests for food, water, shelter, medical supplies, clothing, blankets, or other needs
  - Specify urgency level (low, medium, high, critical) and quantity needed
  - Provide location and optional contact information
  - View all resource requests with filtering by tabs (All Requests / My Requests)
  - Real-time WebSocket updates when new requests are submitted or fulfilled
  - Volunteer/NGO/Admin users can mark requests as fulfilled
  - Status tracking (pending, in_progress, fulfilled, cancelled)
- **Aid Offers System**: Volunteers can list available resources to help disaster victims:
  - Submit offers for food, water, shelter, medical supplies, clothing, blankets, vehicles, or other resources
  - Specify quantity available, location, and contact information
  - GPS location capture for proximity-based matching
  - View all aid offers with filtering by tabs (All Offers / My Offers)
  - AI-powered matching interface showing recommended resource requests based on:
    - Resource type compatibility
    - Geographic proximity using GPS distance calculation
    - Quantity availability vs. need
    - Urgency priority
  - Match scores (0-100%) with detailed reasoning from AI
  - One-click commitment to fulfill specific resource requests
  - Status tracking (available, matched, delivered)
  - Real-time WebSocket updates when new offers are submitted or matched
  - Privacy protection: contact info only visible to offer owner and authorized roles
- Real-time notifications via toast messages
- Responsive sidebar navigation with mobile sheet drawer

### Backend Architecture

**Framework**: Express.js with TypeScript running on Node.js.

**API Design**: RESTful API with the following key endpoints:
- `/api/auth/*` - Authentication routes (Replit Auth integration)
- `/api/reports` - CRUD operations for disaster reports with AI validation on submission
- `/api/reports/:id/verify` - Verification endpoint for crowd-sourced validation
- `/api/resource-requests` - CRUD operations for resource requests
- `/api/resource-requests/mine` - Get current user's resource requests
- `/api/resource-requests/:id/fulfill` - Mark request as fulfilled (volunteer/NGO/admin only)
- `/api/resource-requests/:id/matches` - Get AI-matched aid offers for a specific request
- `/api/aid-offers` - CRUD operations for aid offers (volunteer/NGO/admin only)
- `/api/aid-offers/mine` - Get current user's aid offers
- `/api/aid-offers/:id/matches` - Get AI-matched resource requests for a specific offer
- `/api/aid-offers/:id/commit` - Commit aid offer to fulfill a specific resource request
- `/api/objects/upload` - Generate signed upload URL for media files
- `/api/objects/media` - Set ACL policies for uploaded media files
- `/api/objects/:bucket/:path` - Serve protected media files with ACL checks

**WebSocket Server**: Integrated WebSocket server for real-time push notifications of new reports, updates, verifications, and resource requests.

**Session Management**: Express sessions with PostgreSQL session store (`connect-pg-simple`) for persistent authentication state across server restarts. Sessions use HTTP-only cookies with a 7-day TTL.

**Development Server**: Vite middleware integration in development mode for hot module replacement and seamless frontend/backend coordination.

**Middleware Stack**:
- JSON body parsing with raw body preservation for webhook verification
- Request logging with response timing and JSON capture
- Session middleware with secure cookie configuration (environment-dependent)
- Passport.js for authentication flow

### Database Architecture

**ORM**: Drizzle ORM with PostgreSQL dialect, using Neon serverless driver for database connectivity.

**Schema Design**:

*Sessions Table*: Required for Replit Auth, stores serialized session data with expiration tracking.

*Users Table*: Stores user profiles from Replit Auth including email, name, profile image, and timestamps. Uses UUID primary keys.

*Disaster Reports Table*: Core entity storing incident information including:
- Type (enum: fire, flood, earthquake, storm, accident, other)
- Severity (enum: low, medium, high, critical)
- Status (enum: reported, verified, responding, resolved)
- Location (text description), title, description
- GPS Coordinates: latitude and longitude (optional varchar fields with 6 decimal precision)
- Media URLs: Array of paths to uploaded photos/videos stored in object storage
- AI Validation Score: Integer 0-100 indicating report legitimacy (higher = more legitimate)
- Reporter user ID (foreign key)
- Verification count tracking
- Timestamps for creation/updates

*Verifications Table*: Junction table tracking user verifications of reports to prevent duplicate votes. Composite unique constraint on user_id + report_id.

*Resource Requests Table*: Stores resource requests from disaster victims including:
- Resource Type (enum: food, water, shelter, medical, clothing, blankets, other)
- Urgency (enum: low, medium, high, critical)
- Status (enum: pending, in_progress, fulfilled, cancelled) - defaults to "pending"
- Quantity (integer: number of units needed)
- Description (text: optional details about the request)
- Location (text: delivery location)
- Contact Information (text: optional contact details)
- GPS Coordinates: latitude and longitude (optional for location precision)
- Requester user ID (foreign key)
- Optional disaster report ID (links request to specific incident)
- Fulfillment tracking: fulfilled_by user ID and fulfilled_at timestamp
- Timestamps for creation/updates

*Aid Offers Table*: Stores resource offers from volunteers/NGOs including:
- Resource Type (enum: food, water, shelter, medical, clothing, blankets, vehicle, other)
- Status (enum: available, matched, delivered) - defaults to "available"
- Quantity (integer: number of units available)
- Description (text: optional details about the offer)
- Location (text: pickup/delivery location)
- Contact Information (text: contact details, protected by access control)
- GPS Coordinates: latitude and longitude (optional for proximity matching)
- Offer creator user ID (foreign key)
- Optional disaster report ID (links offer to specific incident)
- Matching tracking: matched_to_request_id, matched_at timestamp
- Timestamps for creation/updates

**Indexes**: Created on session expiration for cleanup queries.

**Database Migration**: Drizzle Kit configured for schema migrations with output to `/migrations` directory.

### Authentication & Authorization

**Provider**: Replit Auth using OpenID Connect (OIDC) standard.

**Implementation**: 
- Passport.js strategy for OIDC flow
- User upsert pattern to create/update user records on login
- Session-based authentication with PostgreSQL persistence
- Protected routes using `isAuthenticated` middleware
- User context available via `req.user` in authenticated routes

**Role-Based Access Control**:
- Four user roles: Citizen (default), Volunteer, NGO, Admin
- Role selection page at `/select-role` for users to choose their role
- Role-based middleware in `server/roleAuth.ts`:
  - `requireRole(...roles)` - Checks if user has one of the allowed roles
  - `requireAdmin` - Admin-only access
  - `requireVolunteer` - Volunteer, NGO, or Admin access
  - `requireNGO` - NGO or Admin access
- Role displayed in user profile with badge component
- Security controls:
  - Only existing admins can assign admin role (prevents privilege escalation)
  - Admins cannot demote themselves (prevents lockout)
  - Frontend filters available role options based on current role
  - All role changes validated server-side with 403 Forbidden on violations

**Admin Provisioning**:
- First admin must be manually promoted via database: `UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'`
- After that, admins can manage other users through application features

**Security**:
- HTTPS-only cookies in production
- CSRF protection via session tokens
- Environment-based secure cookie configuration

**Note on Mobile OTP**: 
- Twilio integration available but not configured
- Phone number and verification timestamp fields exist in users table for future implementation
- If mobile OTP is needed, set up Twilio connector or provide TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN secrets

### External Dependencies

**Authentication Service**: Replit OIDC provider for user authentication (`ISSUER_URL` environment variable).

**Database**: PostgreSQL database (via Neon serverless) referenced by `DATABASE_URL` environment variable. The application will fail to start if this variable is not set.

**OpenAI Service**: AI-powered features via Replit AI Integrations (OpenAI). Uses GPT-4o-mini for:
- Report validation: Analyzing report legitimacy and detecting duplicates (`server/aiValidation.ts`)
- Resource matching: Bidirectional matching between aid offers and resource requests based on type, location, quantity, and urgency (`server/aiMatching.ts`)
No API key required - billed to Replit credits. OpenAI client is lazy-loaded to prevent crashes when API key is missing.

**Object Storage**: Replit App Storage for secure photo/video uploads. Uses ACL (Access Control List) policies to ensure only authenticated users can upload and only authorized users can access media files. Configured via environment variables set by Replit. See `server/objectStorage.ts` and `server/objectAcl.ts` for implementation.

**Google Fonts**: Inter and JetBrains Mono fonts loaded via Google Fonts CDN for consistent typography.

**Third-party NPM Packages**:
- Radix UI primitives for accessible components
- TanStack Query for data fetching
- Wouter for routing
- Drizzle ORM for database operations
- Zod for runtime validation with drizzle-zod integration
- date-fns for date formatting
- lucide-react for icon library

**Development Tools**:
- Replit-specific Vite plugins (cartographer, dev banner, runtime error overlay) for development environment
- ESBuild for server-side production builds
- TSX for TypeScript execution in development

**Environment Variables Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret for session encryption
- `ISSUER_URL` - Replit OIDC provider URL (optional, defaults to replit.com/oidc)
- `REPL_ID` - Replit environment identifier
- `NODE_ENV` - Environment mode (development/production)
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - Object storage bucket ID (set by Replit)
- `PUBLIC_OBJECT_SEARCH_PATHS` - Search paths for public assets (set by Replit)
- `PRIVATE_OBJECT_DIR` - Directory for private objects (set by Replit)