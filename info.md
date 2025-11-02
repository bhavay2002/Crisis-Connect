# Crisis Connect - Complete Application Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Complete File Structure & Explanations](#complete-file-structure--explanations)
4. [Module-by-Module Breakdown](#module-by-module-breakdown)
5. [Technologies Explained](#technologies-explained)
6. [Architecture Patterns](#architecture-patterns)

---

## Project Overview

Crisis Connect is a **real-time disaster management platform** that connects disaster victims, volunteers, NGOs, and government agencies for rapid incident reporting, resource coordination, and emergency response.

### Core Capabilities
- **Emergency Reporting**: GPS-tracked incident reports with multimedia (photos/videos/voice)
- **AI Validation**: GPT-4o-mini validates reports and matches resources
- **Real-time Updates**: WebSocket notifications for live updates
- **Resource Management**: Request/offer matching system
- **Analytics & Insights**: Comprehensive dashboards with export capabilities
- **Admin Controls**: User management, report moderation, and system oversight

---

## Technology Stack

### Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.1 | UI library for building component-based interfaces |
| **TypeScript** | 5.6.3 | Type-safe JavaScript for better developer experience |
| **Vite** | 5.4.20 | Fast build tool and development server with HMR |
| **Wouter** | 3.3.5 | Lightweight client-side routing (1.6KB) |
| **TanStack Query** | 5.60.5 | Server state management, caching, and data fetching |
| **shadcn/ui** | Latest | Component library built on Radix UI |
| **Radix UI** | Various | Accessible, unstyled UI primitives |
| **Tailwind CSS** | 3.4.17 | Utility-first CSS framework |
| **Tailwind CSS v4** | 4.1.3 | New Vite plugin for Tailwind v4 |
| **Lucide React** | 0.453.0 | Icon library with 1000+ icons |
| **React Icons** | 5.4.0 | Company/brand logos (Simple Icons) |
| **Framer Motion** | 11.13.1 | Animation library for smooth transitions |
| **Recharts** | 2.15.2 | Chart library for analytics visualizations |
| **Leaflet** | 1.9.4 | Interactive map library |
| **React Leaflet** | 4.2.1 | React components for Leaflet |
| **Leaflet.heat** | 0.2.0 | Heatmap layer for disaster visualization |
| **TensorFlow.js** | 4.22.0 | Machine learning in the browser |
| **MobileNet** | 2.1.1 | Pre-trained image classification model |
| **Uppy** | 5.x | File upload with AWS S3 support |
| **React Hook Form** | 7.55.0 | Form state management |
| **Zod** | 3.24.2 | Schema validation library |
| **date-fns** | 3.6.0 | Date manipulation library |
| **next-themes** | 0.4.6 | Dark mode theme management |

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Express.js** | 4.21.2 | Web server framework for Node.js |
| **TypeScript** | 5.6.3 | Type-safe server-side code |
| **tsx** | 4.20.5 | TypeScript execution engine for development |
| **Drizzle ORM** | 0.39.1 | Type-safe SQL ORM for PostgreSQL |
| **Drizzle Kit** | 0.31.6 | Database migration tool |
| **Drizzle Zod** | 0.7.0 | Zod schema generation from Drizzle |
| **PostgreSQL** | - | Relational database (Neon serverless) |
| **@neondatabase/serverless** | 0.10.4 | Neon PostgreSQL driver |
| **WebSocket (ws)** | 8.18.0 | Real-time bidirectional communication |
| **Passport.js** | - | Authentication middleware (via strategies) |
| **bcryptjs** | 3.0.2 | Password hashing |
| **jsonwebtoken** | 9.0.2 | JWT token generation and verification |
| **OpenAI SDK** | 6.7.0 | AI validation and matching |
| **Google Cloud Storage** | 7.17.2 | S3-compatible object storage |
| **Google Auth Library** | 10.4.2 | OAuth verification |

### Security & Middleware

| Technology | Purpose |
|------------|---------|
| **Helmet.js** | 8.1.0 - Security headers (CSP, HSTS, etc.) |
| **CORS** | 2.8.5 - Cross-origin resource sharing |
| **express-rate-limit** | 8.1.0 - API rate limiting |
| **csurf** | 1.2.2 - CSRF protection |
| **express-mongo-sanitize** | 2.2.0 - NoSQL injection prevention |
| **express-session** | 1.18.1 - Session management |
| **connect-pg-simple** | 10.0.0 - PostgreSQL session store |
| **memorystore** | 1.6.7 - In-memory cache store |
| **cookie-parser** | 1.4.7 - Cookie parsing middleware |
| **compression** | 1.8.1 - Gzip compression |
| **express-validator** | 7.3.0 - Request validation |

### Development Tools

| Technology | Purpose |
|------------|---------|
| **esbuild** | 0.25.0 - Fast bundler for production |
| **autoprefixer** | 10.4.20 - CSS vendor prefixing |
| **PostCSS** | 8.4.47 - CSS processing |
| **@replit/vite-plugins** | Various - Replit integration |

### Additional Libraries

| Technology | Purpose |
|------------|---------|
| **Sharp** | 0.34.4 - Image processing |
| **image-hash** | 6.0.1 - Perceptual image hashing |
| **exif-parser** | 0.1.12 - Extract EXIF from images |
| **memoizee** | 0.4.17 - Function memoization for caching |
| **Swagger** | - API documentation |

---

## Complete File Structure & Explanations

### Root Level Files

```
/
├── package.json                 # NPM dependencies and scripts
├── package-lock.json            # Locked dependency versions
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite bundler configuration
├── tailwind.config.ts           # Tailwind CSS theme configuration
├── postcss.config.js            # PostCSS configuration
├── drizzle.config.ts            # Drizzle ORM database configuration
├── components.json              # shadcn/ui component configuration
├── README.md                    # Project overview and setup
├── replit.md                    # Project memory and preferences
├── working.md                   # Technical architecture documentation
├── submission.md                # Competition submission details
├── INSTANT_UPDATES.md           # WebSocket implementation notes
├── .gitignore                   # Git ignore patterns
└── .local/                      # Local state and logs
```

#### File Purposes:

**package.json**
- Defines all project dependencies (frontend and backend)
- NPM scripts: `dev` (development), `build` (production), `start` (run production)
- Project metadata and license

**tsconfig.json**
- TypeScript compiler options
- Path aliases (`@/` for client, `@shared/` for shared)
- Target ES2020, strict mode enabled

**vite.config.ts**
- Vite development server on port 5000
- React plugin configuration
- Path aliases matching TypeScript
- Build output directory

**tailwind.config.ts**
- Custom color system (HSL-based)
- Dark mode configuration (`class` strategy)
- shadcn/ui plugin integration
- Custom animations and keyframes

**drizzle.config.ts**
- Database connection configuration
- Migration output directory
- Schema file location

**components.json**
- shadcn/ui component metadata
- Tailwind configuration paths
- Component installation settings

---

### Client Directory Structure

```
client/
├── index.html                   # HTML entry point
├── src/
│   ├── main.tsx                 # React app bootstrap
│   ├── App.tsx                  # Main app with routing
│   ├── index.css                # Global styles and CSS variables
│   ├── components/              # Reusable UI components
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Utilities and configuration
│   ├── modules/                 # Feature modules (organized by domain)
│   └── pages/                   # Standalone pages
```

#### Client Entry Points

**client/index.html**
- Single-page app HTML shell
- Loads `main.tsx` as module
- Meta tags for SEO and mobile

**client/src/main.tsx**
- Renders React root
- Wraps app with providers:
  - `QueryClientProvider` (TanStack Query)
  - `TooltipProvider` (Radix UI)
  - `ErrorBoundary` (error handling)

**client/src/App.tsx**
- Main application component
- Sets up routing with Wouter
- Implements authentication guards
- Route definitions for all pages

**client/src/index.css**
- Global Tailwind directives
- CSS custom properties for theming
- Dark mode color variables
- Base styles and resets

---

### Client Components

```
client/src/components/
├── ui/                          # shadcn/ui components (50+ files)
├── layout/
│   ├── DashboardLayout.tsx      # Main layout with sidebar
│   ├── AlertBanner.tsx          # System-wide alerts
│   └── ErrorBoundary.tsx        # Error catching wrapper
├── feed/
│   ├── DisasterReportCard.tsx   # Report display card
│   ├── ObjectUploader.tsx       # S3 file uploader
│   ├── RoleBadge.tsx            # User role indicator
│   ├── StatsCard.tsx            # Dashboard statistics
│   └── TrustScoreBadge.tsx      # User reputation badge
├── forms/
│   └── ReportSubmissionForm.tsx # Multi-step report form
├── map/
│   ├── HeatmapLayer.tsx         # Leaflet heatmap overlay
│   ├── HeatmapLegend.tsx        # Heatmap color scale
│   ├── LayerControl.tsx         # Map layer toggles
│   └── TimelineControl.tsx      # Time-based filtering
├── FakeDetectionBadge.tsx       # AI validation indicator
├── FakeDetectionDetails.tsx     # Detailed validation info
├── NotificationBell.tsx         # Real-time notification icon
├── TrustBadge.tsx               # Trust score display
├── VoiceRecorder.tsx            # Audio recording widget
└── VotingControls.tsx           # Report verification votes
```

#### Component Explanations

**ui/** - shadcn/ui Components
All components in this directory are from shadcn/ui:
- **accordion.tsx** - Collapsible content sections
- **alert-dialog.tsx** - Modal confirmation dialogs
- **alert.tsx** - Inline alert messages
- **avatar.tsx** - User profile images
- **badge.tsx** - Status labels and tags
- **button.tsx** - Interactive button variants
- **card.tsx** - Content containers
- **checkbox.tsx** - Form checkboxes
- **dialog.tsx** - Modal dialogs
- **dropdown-menu.tsx** - Context menus
- **form.tsx** - Form wrapper with react-hook-form
- **input.tsx** - Text input fields
- **label.tsx** - Form labels
- **select.tsx** - Dropdown selectors
- **table.tsx** - Data tables
- **tabs.tsx** - Tabbed interfaces
- **toast.tsx** - Toast notifications
- And 30+ more components...

**DashboardLayout.tsx**
- Main application layout
- Responsive sidebar navigation
- Role-based menu items
- Mobile drawer support
- User profile dropdown

**DisasterReportCard.tsx**
- Displays individual disaster reports
- Severity indicators
- Media preview
- Action buttons (verify, flag)
- AI validation score

**ObjectUploader.tsx**
- Uppy integration for file uploads
- AWS S3 multipart upload
- Progress tracking
- Image/video preview
- Drag-and-drop support

**RoleBadge.tsx**
- Visual role indicator
- Color-coded by role type
- Used in user lists and profiles

**NotificationBell.tsx**
- Real-time notification icon
- Unread count badge
- Dropdown notification list
- Priority-based styling

**VoiceRecorder.tsx**
- Browser MediaRecorder API
- Record voice notes for reports
- Audio preview and playback
- Upload to S3 storage

**VotingControls.tsx**
- Upvote/downvote buttons
- Consensus score display
- Prevents duplicate votes
- Real-time updates via WebSocket

---

### Client Hooks

```
client/src/hooks/
├── use-toast.ts                 # Toast notification hook
├── use-mobile.tsx               # Mobile viewport detection
├── useAuth.ts                   # Authentication state
├── useWebSocket.ts              # WebSocket connection
├── useImageClassification.ts   # TensorFlow.js inference
└── usePerformance.ts            # Performance monitoring
```

#### Hook Explanations

**useAuth.ts**
- Fetches current user from `/api/auth/me`
- Manages authentication state
- Provides login/logout functions
- Role-based access checks

**useWebSocket.ts**
- Establishes WebSocket connection
- Handles message types (NEW_REPORT, RESOURCE_REQUEST, etc.)
- Auto-reconnection logic
- Event subscriptions
- Used for real-time notifications

**useImageClassification.ts**
- Loads TensorFlow.js MobileNet model
- Client-side disaster type prediction
- Processes uploaded images
- Returns confidence scores

**usePerformance.ts**
- Monitors page load times
- Tracks API response times
- Identifies performance bottlenecks
- Logging to console/server

---

### Client Library

```
client/src/lib/
├── queryClient.ts               # TanStack Query configuration
├── utils.ts                     # Utility functions (cn, etc.)
├── authUtils.ts                 # JWT token handling
└── performance.tsx              # Performance monitoring
```

#### Library Explanations

**queryClient.ts**
- TanStack Query client instance
- Default fetch function
- Cache configuration
- Mutation error handling
- Automatic cache invalidation

**utils.ts**
- `cn()` - Tailwind class merging with clsx
- Other helper functions

**authUtils.ts**
- JWT token storage (localStorage)
- Token refresh logic
- Authorization header injection
- Token expiry handling

---

### Client Modules (Feature-based)

```
client/src/modules/
├── admin/                       # Admin-only features
│   └── pages/
│       ├── AdminDashboard.tsx   # User/report management
│       └── ClusterManagementPage.tsx # Duplicate clustering
├── aid/                         # Aid offer system
│   └── pages/
│       ├── AidOffers.tsx        # List all offers
│       ├── SubmitAidOffer.tsx   # Create new offer
│       ├── AidOfferMatches.tsx  # Match offers to requests
│       ├── AidMatchingDashboard.tsx # Matching interface
│       ├── VolunteerDashboard.tsx # Volunteer home
│       └── MatchingEngine.tsx   # AI matching interface
├── analytics/                   # Analytics and AI
│   └── pages/
│       ├── AnalyticsDashboard.tsx # Charts and metrics
│       ├── ImageClassification.tsx # TensorFlow.js demo
│       └── PredictiveModeling.tsx # Disaster prediction
├── auth/                        # Authentication
│   └── pages/
│       ├── Landing.tsx          # Public landing page
│       ├── Login.tsx            # Login form
│       ├── Register.tsx         # Registration form
│       └── RoleSelection.tsx    # First-time role selection
├── map/                         # Map features
│   └── pages/
│       └── Map.tsx              # Interactive Leaflet map
├── reports/                     # Disaster reporting
│   └── pages/
│       ├── Dashboard.tsx        # Main dashboard
│       ├── ActiveReports.tsx    # All reports list
│       ├── MyReports.tsx        # User's own reports
│       ├── ReportDetails.tsx    # Single report view
│       ├── SubmitReport.tsx     # Multi-step report form
│       └── ResponseTeams.tsx    # Team coordination
├── resources/                   # Resource requests
│   └── pages/
│       ├── ResourceRequests.tsx # List all requests
│       ├── ResourceManagement.tsx # Manage resources
│       └── SubmitResourceRequest.tsx # Create request
└── user/                        # User features
    └── pages/
        ├── UserProfile.tsx      # Profile management
        ├── IdentityVerification.tsx # OTP verification
        ├── ReputationDashboard.tsx # Trust score
        ├── Notifications.tsx    # Notification center
        └── NotificationPreferences.tsx # Settings
```

#### Module Page Explanations

**AdminDashboard.tsx**
- **User Management Tab**: View all users, change roles
- **Report Moderation Tab**: Flag/assign/moderate reports
- **Analytics Export**: CSV/JSON data exports
- Admin-only access (role check)

**ClusterManagementPage.tsx**
- Duplicate report detection
- Cluster visualization
- Merge/unmerge clusters
- Non-AI clustering algorithm

**AidOffers.tsx**
- List all available aid offers
- Filter by type, status, location
- Real-time updates
- Create new offer button

**AidMatchingDashboard.tsx**
- AI-powered resource matching
- Select request, view ranked offers
- Commit offers to requests
- Track fulfillment status

**VolunteerDashboard.tsx**
- Volunteer home screen
- Quick stats (offers, commitments)
- Navigation to aid features
- Recent activity feed

**AnalyticsDashboard.tsx**
- Summary metrics (total reports, users)
- Disaster frequency charts (Recharts)
- Geographic impact data
- Export to CSV/JSON

**ImageClassification.tsx**
- TensorFlow.js demo
- Upload image for classification
- MobileNet disaster type detection
- Confidence scores

**PredictiveModeling.tsx**
- AI disaster prediction
- Historical pattern analysis
- Weather API integration (OpenWeather)
- Seismic data (USGS API)
- Risk level assessment

**Landing.tsx**
- Public-facing landing page
- Hero section with CTAs
- Feature highlights
- Statistics (lives saved, users)

**Login.tsx**
- JWT-based login form
- Email/password validation
- Remember me checkbox
- Error handling

**Register.tsx**
- User registration form
- Password strength validation
- Email verification
- Auto-login on success

**Map.tsx**
- Interactive Leaflet map
- Color-coded severity markers
- Heatmap layer (leaflet.heat)
- Filter by disaster type
- Timeline playback
- Click markers for details

**Dashboard.tsx**
- Main application dashboard
- Key statistics cards
- Recent reports feed
- Quick action buttons
- Real-time updates

**SubmitReport.tsx**
- Multi-step form (4 steps)
  1. Disaster type and severity
  2. Location (GPS or manual)
  3. Media upload (photos/videos/voice)
  4. Description and submission
- GPS geolocation API
- Uppy for media uploads
- AI validation on submit
- Progress indicator

**ResourceRequests.tsx**
- List all resource requests
- Filter by urgency, type
- Request status tracking
- Create new request

**SubmitResourceRequest.tsx**
- Resource request form
- Type selection (food, water, shelter, medical)
- Urgency level
- Quantity and location
- Automatic GPS capture

**UserProfile.tsx**
- Edit profile information
- Upload profile image
- Change password
- View trust score
- Account settings

**IdentityVerification.tsx**
- Email OTP verification
- Phone SMS OTP verification
- Simulated Aadhaar verification
- Increases trust score

**ReputationDashboard.tsx**
- Trust score visualization
- Contribution history
- Achievements and badges
- Reputation breakdown

**Notifications.tsx**
- Notification center
- Mark as read/unread
- Filter by priority
- Real-time WebSocket updates

---

### Server Directory Structure

```
server/
├── index.ts                     # Express server entry point
├── routes.ts                    # Legacy route aggregator
├── vite.ts                      # Vite dev server integration
├── config/                      # Configuration files
├── db/                          # Database layer
├── errors/                      # Custom error classes
├── middleware/                  # Express middleware
├── modules/                     # Feature modules (controllers/services)
├── routes/                      # API route definitions
├── scripts/                     # Database seeding scripts
├── shared/                      # Shared utilities (audit, security, storage)
├── utils/                       # Utility functions
└── validators/                  # Request validators
```

---

### Server Entry Point

**server/index.ts**
- Express app initialization
- Middleware stack:
  - Helmet.js (security headers)
  - CORS (cross-origin requests)
  - Compression (gzip)
  - JSON/URL-encoded body parsing
  - Cookie parser
  - NoSQL injection sanitization
  - Request logging
- WebSocket server setup
- Route registration
- Error handling
- Port 5000 listening

**server/vite.ts**
- Vite development server integration
- Hot module replacement (HMR)
- Static file serving in production
- Frontend proxy in development

---

### Server Configuration

```
server/config/
├── index.ts                     # Main configuration
├── rateLimits.ts                # Rate limit definitions
└── swagger.ts                   # Swagger API docs
```

**config/index.ts**
- Environment variable loading
- Database URL
- JWT secrets
- OpenAI API key
- S3 credentials
- Session secret

**config/rateLimits.ts**
- Global rate limit: 100 req/15min
- Auth endpoints: 5 req/15min
- Report submission: 10 req/hour
- AI requests: 20 req/hour

---

### Server Database Layer

```
server/db/
├── db.ts                        # Drizzle database instance
├── storage.ts                   # Database operations (CRUD)
└── seed.ts                      # Sample data seeding
```

**db/db.ts**
- Neon PostgreSQL connection
- Drizzle ORM instance
- Connection pooling

**db/storage.ts**
- All database operations
- CRUD functions for each table:
  - `getUsers()`, `getUserById()`, `createUser()`
  - `getReports()`, `createReport()`, `updateReport()`
  - `getResourceRequests()`, `createResourceRequest()`
  - `getAidOffers()`, `createAidOffer()`
  - `createNotification()`, `getUserNotifications()`
- Type-safe with Drizzle
- Transaction support

**db/seed.ts**
- Populates database with sample data
- Creates test users, reports, resources
- Development/testing only

---

### Server Errors

```
server/errors/
└── AppError.ts                  # Custom error class
```

**AppError.ts**
- Extends JavaScript Error
- HTTP status code
- Error message
- Used throughout app for consistent error handling

---

### Server Middleware

```
server/middleware/
├── apiVersion.ts                # API versioning
├── auditLog.ts                  # Audit logging
├── commonChecks.ts              # Shared validation
├── errorHandler.ts              # Global error handling
├── jwtAuth.ts                   # JWT authentication
├── objectAcl.ts                 # Object access control
├── pagination.ts                # Pagination helper
├── rateLimiting.ts              # Rate limiting
├── roleAuth.ts                  # Role-based access
└── wsRateLimiting.ts            # WebSocket rate limits
```

**jwtAuth.ts**
- Verifies JWT tokens
- Attaches user to `req.user`
- Access token validation
- Refresh token handling

**roleAuth.ts**
- `requireRole(['admin', 'volunteer'])` middleware
- Checks user role
- Returns 403 if unauthorized

**errorHandler.ts**
- Catches all errors
- Formats error responses
- Logs errors to console
- Development vs production modes

**pagination.ts**
- Standardized pagination
- Query params: `page`, `limit`
- Returns metadata: `total`, `pages`, `currentPage`

**rateLimiting.ts**
- Express rate limit middleware
- Per-IP tracking
- Configurable limits
- Error messages

---

### Server Modules (Feature-based)

```
server/modules/
├── ai/
│   ├── crisis-guidance.controller.ts # AI guidance
│   ├── matching.controller.ts        # AI resource matching
│   └── validation.service.ts         # AI report validation
├── aid/
│   ├── aid.controller.ts             # Aid offer endpoints
│   └── aid.service.ts                # Aid business logic
├── analytics/
│   └── prediction.service.ts         # Predictive modeling
├── notifications/
│   └── notification.service.ts       # Notification logic
├── reports/
│   ├── fake-report-detection.service.ts # Duplicate detection
│   ├── report.controller.ts          # Report endpoints
│   └── report.service.ts             # Report business logic
└── resources/
    ├── resource.controller.ts        # Resource endpoints
    └── resource.service.ts           # Resource business logic
```

#### Module Service/Controller Explanations

**validation.service.ts**
- Calls OpenAI GPT-4o-mini API
- Validates report legitimacy
- Returns confidence score (0-1)
- Considers: coherence, location, severity

**matching.controller.ts**
- AI-powered resource matching
- Compares request vs offers
- Ranks by: type match, location proximity, quantity
- Returns sorted match list

**aid.controller.ts**
- `GET /api/aid-offers` - List offers
- `POST /api/aid-offers` - Create offer
- `PATCH /api/aid-offers/:id` - Update offer
- `POST /api/aid-offers/:id/commit` - Commit to request

**prediction.service.ts**
- Fetches weather data (OpenWeather API)
- Fetches seismic data (USGS API)
- Analyzes historical disaster patterns
- Predicts affected areas and risk levels

**notification.service.ts**
- Creates notifications
- WebSocket broadcasting
- Priority levels (low, medium, high, critical)
- User preference filtering

**fake-report-detection.service.ts**
- Non-AI duplicate detection
- Text similarity (Levenshtein distance)
- Location proximity (< 1km)
- Time proximity (< 1 hour)
- Type matching
- Clustering algorithm

**report.service.ts**
- Business logic for reports
- Validation, creation, updates
- Verification counting
- Status changes
- Admin moderation

---

### Server Routes

```
server/routes/
├── index.ts                     # Route aggregator
├── auth.routes.ts               # Authentication
├── newAuth.routes.ts            # JWT auth endpoints
├── reports.routes.ts            # Disaster reports
├── resources.routes.ts          # Resource requests
├── aid.routes.ts                # Aid offers
├── analytics.routes.ts          # Analytics
├── ai.routes.ts                 # AI services
├── cache.routes.ts              # Cache management
├── chat.routes.ts               # AI chat guidance
├── clustering.routes.ts         # Duplicate clustering
├── export.routes.ts             # Data export
├── inventory.routes.ts          # Inventory management
├── sos.routes.ts                # SOS emergency
├── storage.routes.ts            # Object storage
└── tasks.routes.ts              # Background tasks
```

#### Route File Explanations

**auth.routes.ts** (Legacy OAuth)
- `GET /api/auth/login` - Replit Auth login
- `GET /api/auth/callback` - OAuth callback
- `POST /api/auth/logout` - End session
- `GET /api/auth/user` - Get current user

**newAuth.routes.ts** (JWT)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - JWT login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Clear refresh token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/verify-email` - Email OTP
- `POST /api/auth/verify-phone` - Phone OTP
- `POST /api/auth/verify-aadhaar` - Aadhaar verification

**reports.routes.ts**
- `GET /api/reports` - List reports (with filters)
- `POST /api/reports` - Create report
- `GET /api/reports/:id` - Get single report
- `POST /api/reports/:id/verify` - Verify report
- `POST /api/reports/:id/vote` - Upvote/downvote
- `PATCH /api/reports/:id/flag` - Flag report (admin)
- `PATCH /api/reports/:id/assign` - Assign to team (admin)
- `PATCH /api/reports/:id/status` - Update status (admin)

**resources.routes.ts**
- `GET /api/resource-requests` - List requests
- `POST /api/resource-requests` - Create request
- `PATCH /api/resource-requests/:id` - Update request

**aid.routes.ts**
- `GET /api/aid-offers` - List offers
- `POST /api/aid-offers` - Create offer
- `PATCH /api/aid-offers/:id` - Update offer
- `POST /api/aid-offers/:id/commit` - Commit to request
- `POST /api/aid-offers/match-requests` - AI matching

**analytics.routes.ts**
- `GET /api/analytics/summary` - Summary metrics
- `GET /api/analytics/disaster-frequency` - Disaster counts
- `GET /api/analytics/geographic-impact` - Geographic data
- `GET /api/analytics/predictions` - Predictive modeling

**ai.routes.ts**
- `POST /api/ai/validate-report` - Validate report with AI
- `POST /api/ai/match-resources` - Match resources with AI
- `POST /api/ai/crisis-guidance` - Get AI guidance

**storage.routes.ts**
- `POST /api/storage/upload` - Upload file to S3
- `DELETE /api/storage/:key` - Delete file
- `GET /api/storage/:key/url` - Get signed URL

**export.routes.ts**
- `GET /api/export/reports/csv` - Export reports as CSV
- `GET /api/export/reports/json` - Export reports as JSON
- `GET /api/export/analytics/csv` - Export analytics as CSV

---

### Server Shared Utilities

```
server/shared/
├── audit/
│   └── audit-logger.ts          # Audit logging
├── security/
│   ├── encryption.ts            # AES encryption
│   └── object-acl.ts            # ACL for objects
├── storage/
│   └── object-storage.ts        # S3 operations
└── websocket/
    └── ws-encryption.ts         # WebSocket encryption
```

**audit-logger.ts**
- Logs all auth events (login, logout, registration)
- Records user actions (create report, update request)
- Stores in database for compliance
- Admin access to audit logs

**encryption.ts**
- AES-256-GCM encryption
- Encrypts sensitive WebSocket messages
- ENCRYPTION_KEY from environment
- Auto-generates key in development

**object-acl.ts**
- Access control for uploaded files
- Ownership verification
- Admin override
- Prevents unauthorized access

**object-storage.ts**
- AWS S3 SDK integration
- Upload files with progress
- Generate signed URLs
- Delete files
- Multipart uploads

**ws-encryption.ts**
- Optional WebSocket message encryption
- Encrypts messages by type
- Decrypts on client
- Additional security layer

---

### Server Utils

```
server/utils/
├── cache.ts                     # In-memory caching
├── clustering.ts                # Duplicate clustering
├── jobQueue.ts                  # Background jobs
├── jwtUtils.ts                  # JWT helpers
├── logger.ts                    # Structured logging
├── passwordUtils.ts             # Password hashing
├── queryMonitor.ts              # Query performance
├── streamExport.ts              # Streaming CSV/JSON
├── taskQueue.ts                 # Task queue
└── validation.ts                # Input validation
```

**cache.ts**
- In-memory LRU cache (memoizee)
- Caches frequently accessed data
- Configurable TTL
- Automatic invalidation on updates
- Cache keys: reports, users, stats

**clustering.ts**
- Groups duplicate reports
- Text similarity algorithm
- Location proximity
- Time window clustering
- Returns cluster groups

**jobQueue.ts**
- Background task processing
- Retry logic
- Graceful shutdown
- Used for: email sending, AI processing

**jwtUtils.ts**
- Generate access tokens (15min)
- Generate refresh tokens (7 days)
- Verify tokens
- Extract user from token

**logger.ts**
- Structured logging (JSON)
- Log levels: debug, info, warn, error
- Context-aware logging
- Console and file output

**passwordUtils.ts**
- bcrypt password hashing
- Password strength validation
- Compare hashed passwords
- Salt rounds: 10

**streamExport.ts**
- Streams large datasets
- CSV and JSON export
- Memory-efficient
- Used for analytics export

---

### Shared Directory

```
shared/
├── schema.ts                    # Database schema (Drizzle)
├── validation.ts                # Shared validation schemas
├── pagination.ts                # Pagination types
├── filtering.ts                 # Filter types
├── inputValidation.ts           # Input sanitization
└── changeTracking.ts            # Change tracking
```

**shared/schema.ts** (Most Important File)
- Single source of truth for data models
- Drizzle ORM table definitions
- Zod validation schemas
- TypeScript types (insert/select)

Tables defined:
- `sessions` - Session storage
- `users` - User accounts
- `disasterReports` - Emergency reports
- `verifications` - Report verification votes
- `resourceRequests` - Resource needs
- `aidOffers` - Available resources
- `notifications` - User notifications
- `notificationPreferences` - Notification settings
- `reportClusters` - Duplicate groupings
- `userReputation` - Trust scores
- `auditLogs` - System audit trail
- `responseTeams` - Emergency teams
- `inventory` - Resource inventory
- `sosAlerts` - Emergency SOS

**validation.ts**
- Shared Zod schemas
- Email validation
- Phone validation
- GPS coordinate validation

---

## Module-by-Module Breakdown

### Authentication Module

**Frontend**
- `modules/auth/pages/Login.tsx`
- `modules/auth/pages/Register.tsx`
- `modules/auth/pages/RoleSelection.tsx`
- `hooks/useAuth.ts`

**Backend**
- `routes/newAuth.routes.ts`
- `middleware/jwtAuth.ts`
- `middleware/roleAuth.ts`
- `utils/jwtUtils.ts`
- `utils/passwordUtils.ts`

**Flow**
1. User registers → Password hashed → User created
2. User logs in → JWT tokens generated → Stored in localStorage
3. Access token (15min) → Refresh token (7 days)
4. Token sent in Authorization header
5. Middleware verifies token → Attaches user to req.user

---

### Disaster Reporting Module

**Frontend**
- `modules/reports/pages/SubmitReport.tsx`
- `modules/reports/pages/ActiveReports.tsx`
- `modules/reports/pages/ReportDetails.tsx`
- `components/feed/DisasterReportCard.tsx`
- `components/VoiceRecorder.tsx`

**Backend**
- `routes/reports.routes.ts`
- `modules/reports/report.controller.ts`
- `modules/reports/report.service.ts`
- `modules/ai/validation.service.ts`

**Flow**
1. User fills multi-step form
2. Captures GPS (geolocation API)
3. Uploads media to S3
4. Submits to `/api/reports`
5. Backend validates with Zod
6. Calls OpenAI for AI validation
7. Saves to database
8. Broadcasts via WebSocket
9. All clients receive update

---

### Resource Management Module

**Frontend**
- `modules/resources/pages/ResourceRequests.tsx`
- `modules/resources/pages/SubmitResourceRequest.tsx`
- `modules/aid/pages/AidOffers.tsx`
- `modules/aid/pages/SubmitAidOffer.tsx`
- `modules/aid/pages/AidMatchingDashboard.tsx`

**Backend**
- `routes/resources.routes.ts`
- `routes/aid.routes.ts`
- `modules/resources/resource.controller.ts`
- `modules/aid/aid.controller.ts`
- `modules/ai/matching.controller.ts`

**Flow**
1. Victim creates resource request
2. Volunteer creates aid offer
3. Admin/Volunteer goes to matching dashboard
4. Selects request → AI ranks offers by:
   - Type match
   - Location proximity
   - Quantity availability
5. User commits offer to request
6. Both statuses update to "committed"
7. Track until "delivered"

---

### Analytics Module

**Frontend**
- `modules/analytics/pages/AnalyticsDashboard.tsx`
- `modules/analytics/pages/ImageClassification.tsx`
- `modules/analytics/pages/PredictiveModeling.tsx`

**Backend**
- `routes/analytics.routes.ts`
- `modules/analytics/prediction.service.ts`

**Flow**
1. Admin views analytics dashboard
2. Backend aggregates data:
   - Total reports by type
   - Verification rates
   - Geographic distribution
   - Response times
3. Frontend displays with Recharts
4. Export to CSV/JSON
5. Predictive modeling uses external APIs

---

### Admin Module

**Frontend**
- `modules/admin/pages/AdminDashboard.tsx`
- `modules/admin/pages/ClusterManagementPage.tsx`

**Backend**
- `routes/auth.routes.ts` (user management endpoints)
- `middleware/roleAuth.ts`

**Flow**
1. Admin views user list
2. Can change user roles (except self)
3. Moderate reports (flag, assign, notes)
4. Manage duplicate clusters
5. Export data

---

### Map Module

**Frontend**
- `modules/map/pages/Map.tsx`
- `components/map/HeatmapLayer.tsx`
- `components/map/LayerControl.tsx`
- `components/map/TimelineControl.tsx`

**Technologies**
- Leaflet for base map
- leaflet.heat for heatmap
- OpenStreetMap tiles

**Features**
- Color-coded markers by severity
- Heatmap intensity by report density
- Filter by disaster type
- Timeline playback
- Click markers for details

---

### Notification Module

**Frontend**
- `modules/user/pages/Notifications.tsx`
- `modules/user/pages/NotificationPreferences.tsx`
- `components/NotificationBell.tsx`
- `hooks/useWebSocket.ts`

**Backend**
- `modules/notifications/notification.service.ts`
- WebSocket server in `server/index.ts`

**Flow**
1. Event occurs (new report, resource match)
2. Backend creates notification
3. Broadcasts via WebSocket
4. Client receives message
5. Updates notification state
6. Shows toast and badge
7. Stores in database

---

## Technologies Explained

### 1. React
**Purpose**: UI library for building component-based interfaces
**Why**: Component reusability, virtual DOM, large ecosystem
**Usage**: All frontend pages and components

### 2. TypeScript
**Purpose**: Type-safe JavaScript
**Why**: Catch errors at compile time, better IDE support, self-documenting code
**Usage**: Entire codebase (frontend and backend)

### 3. Vite
**Purpose**: Fast build tool and dev server
**Why**: Instant HMR, fast builds, ES modules
**Usage**: Development server on port 5000, production bundling

### 4. Express.js
**Purpose**: Web server framework
**Why**: Simple, flexible, large middleware ecosystem
**Usage**: Backend API server, route handling, middleware

### 5. Drizzle ORM
**Purpose**: Type-safe SQL ORM
**Why**: Full TypeScript support, no code generation, migrations
**Usage**: Database schema, queries, migrations

### 6. PostgreSQL (Neon)
**Purpose**: Relational database
**Why**: ACID compliance, complex queries, JSON support
**Usage**: All data storage (users, reports, resources)

### 7. TanStack Query
**Purpose**: Server state management
**Why**: Automatic caching, refetching, optimistic updates
**Usage**: All data fetching, mutations, cache management

### 8. Wouter
**Purpose**: Lightweight routing
**Why**: Only 1.6KB, hook-based API, simple
**Usage**: Client-side navigation

### 9. shadcn/ui
**Purpose**: Component library
**Why**: Copy-paste (no npm package), customizable, accessible
**Usage**: All UI components (buttons, forms, dialogs)

### 10. Radix UI
**Purpose**: Unstyled accessible components
**Why**: WAI-ARIA compliant, keyboard navigation, screen reader support
**Usage**: Foundation for shadcn/ui

### 11. Tailwind CSS
**Purpose**: Utility-first CSS framework
**Why**: Fast development, small bundle, responsive design
**Usage**: All styling throughout app

### 12. Zod
**Purpose**: Schema validation
**Why**: TypeScript-first, type inference, error messages
**Usage**: Form validation, API validation, schema generation

### 13. React Hook Form
**Purpose**: Form state management
**Why**: Performance (uncontrolled), minimal re-renders
**Usage**: All forms (report submission, login, etc.)

### 14. Leaflet
**Purpose**: Interactive maps
**Why**: Open source, mobile-friendly, plugin ecosystem
**Usage**: Map visualization with disaster markers

### 15. WebSocket (ws)
**Purpose**: Real-time bidirectional communication
**Why**: Low latency, persistent connection, push notifications
**Usage**: Live updates for reports, resources, notifications

### 16. OpenAI SDK
**Purpose**: AI integration
**Why**: GPT-4o-mini for validation and matching
**Usage**: Report validation, resource matching, crisis guidance

### 17. TensorFlow.js
**Purpose**: Machine learning in browser
**Why**: Client-side inference, no server cost
**Usage**: Image classification (MobileNet)

### 18. Uppy
**Purpose**: File upload widget
**Why**: Progress tracking, S3 multipart, drag-and-drop
**Usage**: Media upload for reports

### 19. bcryptjs
**Purpose**: Password hashing
**Why**: Secure, slow (prevents brute force)
**Usage**: User password storage

### 20. jsonwebtoken
**Purpose**: JWT tokens
**Why**: Stateless authentication, portable
**Usage**: Access and refresh tokens

### 21. Helmet.js
**Purpose**: Security headers
**Why**: CSP, HSTS, XSS protection
**Usage**: All HTTP responses

### 22. CORS
**Purpose**: Cross-origin resource sharing
**Why**: Allows frontend to call backend API
**Usage**: API endpoint protection

### 23. express-rate-limit
**Purpose**: Rate limiting
**Why**: Prevents abuse, DDoS protection
**Usage**: API endpoints (especially auth)

### 24. Recharts
**Purpose**: Chart library
**Why**: React components, responsive, simple
**Usage**: Analytics dashboard visualizations

### 25. date-fns
**Purpose**: Date manipulation
**Why**: Lightweight, immutable, tree-shakable
**Usage**: Date formatting, relative times

### 26. Sharp
**Purpose**: Image processing
**Why**: Fast, resize, optimize images
**Usage**: Image optimization before upload

### 27. Framer Motion
**Purpose**: Animation library
**Why**: Simple API, spring animations, gestures
**Usage**: Page transitions, UI animations

### 28. Swagger
**Purpose**: API documentation
**Why**: Interactive docs, testing interface
**Usage**: API endpoint documentation

### 29. compression
**Purpose**: Gzip compression
**Why**: Reduces response size, faster transfers
**Usage**: All API responses > 1KB

### 30. express-session
**Purpose**: Session management
**Why**: Server-side sessions, PostgreSQL store
**Usage**: User sessions (legacy OAuth)

---

## Architecture Patterns

### 1. Monorepo Structure
- Single repository
- Shared code in `/shared`
- Client and server separation
- Simplified development

### 2. TypeScript Everywhere
- Type safety across stack
- Shared types
- Better refactoring
- Self-documenting

### 3. Feature-based Modules
- Organized by domain (auth, reports, resources)
- Co-located frontend/backend code
- Easier navigation
- Scalable structure

### 4. API-first Design
- RESTful API
- Clear endpoints
- Consistent responses
- Version control

### 5. Real-time Updates
- WebSocket for push
- TanStack Query for polling
- Optimistic updates
- Cache invalidation

### 6. Security Layers
- JWT authentication
- Role-based access
- Rate limiting
- Input validation
- CSRF protection
- Security headers

### 7. Progressive Enhancement
- Works without JavaScript (server-side rendering potential)
- Graceful degradation
- Accessibility first

### 8. Mobile-first Design
- Responsive layouts
- Touch-friendly
- Fast loading
- Offline support (potential)

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host/db

# JWT Authentication
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key

# AI Integration
OPENAI_API_KEY=sk-...

# Object Storage (S3-compatible)
BUCKET_NAME=crisis-connect-media
BUCKET_HOST=storage.provider.com
ACCESS_KEY_ID=...
SECRET_ACCESS_KEY=...

# Session (Legacy)
SESSION_SECRET=random_string
ENCRYPTION_KEY=32_byte_key

# External APIs (for predictive modeling)
OPENWEATHER_API_KEY=...
USGS_API_ENDPOINT=https://earthquake.usgs.gov/

# Server
PORT=5000
NODE_ENV=production
```

---

## Build & Deployment

### Development
```bash
npm install          # Install dependencies
npm run dev          # Start dev server (port 5000)
```

### Production
```bash
npm run build        # Build frontend and backend
npm run start        # Start production server
```

### Database
```bash
npm run db:push      # Push schema changes
```

---

## Key Takeaways

1. **Full-stack TypeScript** - Type safety everywhere
2. **Modern stack** - React, Express, PostgreSQL, Drizzle
3. **Real-time** - WebSocket for live updates
4. **AI-powered** - OpenAI for validation and matching
5. **Mobile-first** - Responsive design for emergencies
6. **Secure** - JWT, rate limiting, encryption
7. **Scalable** - Feature modules, caching, pagination
8. **Accessible** - Radix UI, keyboard navigation
9. **Performance** - Vite, compression, caching
10. **Developer experience** - TypeScript, HMR, structured logging

---

This documentation covers every file, technology, and architectural decision in the Crisis Connect platform. Use it as a reference for understanding, extending, or maintaining the application.
