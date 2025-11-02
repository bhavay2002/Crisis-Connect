# Crisis Connect - Technical Architecture & Working Guide

**Last Updated**: November 2, 2025

This document provides a comprehensive technical explanation of the Crisis Connect platform, including its architecture, file structure, data flow, and how all components work together.

## Quick Reference
- For detailed file-by-file documentation, see [info.md](./info.md)
- For project overview, see [README.md](./README.md)
- For competition details, see [submission.md](./submission.md)

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Application Flow](#application-flow)
3. [File Structure & Responsibilities](#file-structure--responsibilities)
4. [Database Schema](#database-schema)
5. [Authentication & Authorization](#authentication--authorization)
6. [Real-time Communication](#real-time-communication)
7. [API Endpoints](#api-endpoints)
8. [Frontend Architecture](#frontend-architecture)
9. [Data Flow Diagrams](#data-flow-diagrams)

---

## System Architecture Overview

Crisis Connect follows a modern full-stack architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  React + TypeScript + Vite + TanStack Query + Wouter        │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                       SERVER LAYER                           │
│        Express.js + TypeScript + Passport.js                 │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌────────────────┬───────────────┬──────────────┬─────────────┐
│   PostgreSQL   │  Replit Auth  │ OpenAI API   │   S3 Storage│
│   (Neon DB)    │   (OIDC)      │ (Validation) │   (Media)   │
└────────────────┴───────────────┴──────────────┴─────────────┘
```

### Key Architectural Decisions

1. **Monorepo Structure**: Single codebase with client/server separation
2. **TypeScript Throughout**: Type safety across frontend and backend
3. **Shared Schema**: Single source of truth for data models
4. **Session-based Auth**: Secure server-side session management
5. **Real-time Updates**: WebSocket for live notifications
6. **AI Integration**: GPT-4o-mini for report validation and matching

---

## Application Flow

### 1. Initial Load & Authentication

```
User visits app → Vite serves React app → Check session
                                              ↓
                                    No session? → Login page
                                              ↓
                                    Has session? → Check role
                                              ↓
                                    No role? → Role selection
                                              ↓
                                    Has role → Dashboard
```

### 2. Report Submission Flow

```
User → Report Form → GPS Capture → Media Upload (S3)
                          ↓
                    AI Validation (OpenAI)
                          ↓
                    Save to Database
                          ↓
                    WebSocket Broadcast
                          ↓
                All connected clients receive update
```

### 3. Resource Request/Offer Matching

```
Victim submits request → Saved to DB → WebSocket notification
                                             ↓
Volunteer sees request → Offers aid → AI matches best offers
                                             ↓
                              Commitment created → Update statuses
                                             ↓
                              Track fulfillment → Mark delivered
```

---

## File Structure & Responsibilities

### Root Level Files

```
/
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite bundler configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── drizzle.config.ts      # Database ORM configuration
├── README.md              # Project overview
├── working.md             # This file (technical docs)
└── replit.md              # Project memory/preferences
```

### Client Directory (`/client`)

#### Entry Point
- **`client/index.html`**: HTML entry point, loads React app
- **`client/src/main.tsx`**: React app bootstrap, sets up providers

#### Core Application
- **`client/src/App.tsx`**: 
  - Main application component
  - Sets up routing with Wouter
  - Defines all routes and their components
  - Implements authentication guards

#### Components (`/client/src/components`)

**Layout Components**:
- **`layout/DashboardLayout.tsx`**: 
  - Main layout wrapper with sidebar navigation
  - Role-based menu rendering
  - Responsive design with mobile support

**UI Components** (`/client/src/components/ui`):
- shadcn/ui components (Button, Card, Dialog, Form, etc.)
- Pre-built, accessible components from Radix UI
- Styled with Tailwind CSS

#### Pages (`/client/src/pages`)

**Authentication Pages**:
- **`auth/Login.tsx`**: Login with Replit Auth
- **`auth/RoleSelection.tsx`**: Role selection for new users

**Feed Pages** (Main Application):
- **`feed/Dashboard.tsx`**: 
  - Main dashboard with statistics
  - Active reports display
  - Filtering and search

- **`feed/ReportEmergency.tsx`**:
  - Multi-step form for emergency reporting
  - GPS capture with geolocation API
  - Media upload using Uppy
  - AI validation integration

- **`feed/MapView.tsx`**:
  - Interactive Leaflet map
  - Color-coded severity markers
  - Clickable markers with report details
  - Filtering by type/severity

- **`feed/ResourceRequests.tsx`**:
  - List of resource requests
  - Create new requests
  - Track request status
  - Real-time updates

- **`feed/VolunteerHub.tsx`**:
  - Volunteer/NGO dashboard
  - Aid offers management
  - AI-powered matching interface
  - Request commitment tracking

- **`feed/AdminDashboard.tsx`**:
  - Admin-only control panel
  - **User Management Tab**: View and manage user roles
  - **Report Moderation Tab**: Flag, assign, and manage reports
  - **Export functionality**: (linked from Analytics)

- **`feed/AnalyticsDashboard.tsx`**:
  - Comprehensive analytics dashboard
  - Charts and visualizations (Recharts)
  - **Export functionality**: CSV and JSON reports
  - Government-ready data exports

#### Library (`/client/src/lib`)

- **`queryClient.ts`**:
  - TanStack Query configuration
  - API request helpers
  - Default fetch function
  - Error handling

- **`useWebSocket.ts`**:
  - Custom WebSocket hook
  - Real-time message handling
  - Auto-reconnection logic
  - Event listeners

#### Styles
- **`client/src/index.css`**: 
  - Global styles
  - CSS custom properties (color system)
  - Tailwind directives
  - Dark mode variables

### Server Directory (`/server`)

#### Entry Point
- **`server/index.ts`**:
  - Express server setup
  - Middleware configuration
  - Session management with PostgreSQL store
  - WebSocket server initialization
  - Vite integration for development
  - Route registration

#### Routes (`/server/routes`)

- **`auth.routes.ts`**:
  - Authentication endpoints
  - Passport.js setup
  - Login/logout/session check
  - Role selection
  - **User management endpoints** (admin only)

- **`reports.routes.ts`**:
  - Report CRUD operations
  - AI validation integration
  - Verification endpoints
  - Media URL handling
  - Filtering and search

- **`resources.routes.ts`**:
  - Resource request endpoints
  - Aid offer endpoints
  - AI matching logic
  - Commitment tracking
  - Status updates

- **`analytics.routes.ts`**:
  - Analytics summary calculations
  - Disaster frequency analysis
  - Geographic impact data
  - Response time metrics

- **`upload.routes.ts`**:
  - Media upload to S3 storage
  - Secure file handling
  - URL generation

#### Storage Layer
- **`server/storage.ts`**:
  - Database abstraction layer
  - All CRUD operations
  - Drizzle ORM queries
  - Type-safe database operations

#### Vite Integration
- **`server/vite.ts`**:
  - Vite dev server integration
  - Hot module replacement
  - Static file serving in production

### Shared Directory (`/shared`)

- **`shared/schema.ts`**:
  - **Single source of truth** for all data models
  - Drizzle ORM table definitions
  - Zod validation schemas
  - TypeScript types (insert/select)
  
  **Tables Defined**:
  - `sessions`: Session storage
  - `users`: User accounts
  - `disasterReports`: Emergency reports
  - `verifications`: Report verification tracking
  - `resourceRequests`: Resource needs
  - `aidOffers`: Available resources

### Database Directory (`/db`)

- **`db/migrations/`**: Auto-generated SQL migrations (via Drizzle Kit)

---

## Database Schema

### Users Table
```typescript
{
  id: varchar (UUID, primary key)
  email: text (unique, not null)
  name: text
  image: text
  phoneNumber: text
  role: text ('citizen' | 'volunteer' | 'ngo' | 'admin')
  createdAt: timestamp (default now)
}
```

### Disaster Reports Table
```typescript
{
  id: varchar (UUID, primary key)
  type: text (earthquake, flood, fire, etc.)
  severity: text (low, moderate, high, critical)
  status: text (pending, verified, resolved)
  location: text (human-readable address)
  latitude: real
  longitude: real
  description: text
  mediaUrls: text[] (array of S3 URLs)
  aiValidationScore: real (0-1, confidence score)
  reporterId: varchar (foreign key to users)
  verificationCount: integer (crowd votes)
  flagType: text (false_report, duplicate, spam)
  flaggedBy: varchar (admin who flagged)
  assignedTo: varchar (volunteer/admin assigned)
  adminNotes: text
  createdAt: timestamp
}
```

### Resource Requests Table
```typescript
{
  id: varchar (UUID, primary key)
  type: text (food, water, shelter, medical, etc.)
  urgency: text (low, medium, high, critical)
  status: text (pending, committed, fulfilled)
  quantity: text
  description: text
  location: text
  latitude: real
  longitude: real
  requesterId: varchar (foreign key to users)
  fulfilledBy: varchar (aid offer ID)
  createdAt: timestamp
}
```

### Aid Offers Table
```typescript
{
  id: varchar (UUID, primary key)
  type: text (resource type)
  status: text (available, committed, delivered)
  quantity: text
  description: text
  location: text
  latitude: real
  longitude: real
  offererId: varchar (foreign key to users)
  matchedRequestId: varchar (resource request ID)
  createdAt: timestamp
}
```

### Verifications Table
```typescript
{
  id: varchar (UUID, primary key)
  reportId: varchar (foreign key to disaster reports)
  userId: varchar (foreign key to users)
  createdAt: timestamp
  
  Unique constraint: (reportId, userId)
  Purpose: Prevent duplicate votes
}
```

---

## Authentication & Authorization

### Authentication Flow

1. **Initial Request**: User clicks "Login with Replit"
2. **OAuth Redirect**: Redirected to Replit Auth (OIDC provider)
3. **Authorization**: User authorizes the application
4. **Callback**: Replit redirects back with authorization code
5. **Token Exchange**: Server exchanges code for user info
6. **Session Creation**: Server creates session in PostgreSQL
7. **Cookie**: Session ID sent as HTTP-only cookie
8. **Role Check**: First-time users select role

### Authorization Middleware

**`isAuthenticated`**: Checks if user has valid session
```typescript
// Used on: All protected routes
if (!req.isAuthenticated()) {
  return res.status(401).json({ message: "Unauthorized" });
}
```

**`requireRole`**: Checks if user has specific role
```typescript
// Example: Admin-only endpoints
requireRole(['admin'])
// Example: Volunteer or NGO endpoints
requireRole(['volunteer', 'ngo', 'admin'])
```

### Security Features

1. **Session Storage**: PostgreSQL (not in-memory)
2. **HTTPS-Only Cookies**: Prevent interception
3. **CSRF Protection**: Via csurf middleware
4. **Role Validation**: Server-side role checks
5. **Admin Protection**: Cannot demote self, admin provisioning via DB only

---

## Real-time Communication

### WebSocket Architecture

**Server Side** (`server/index.ts`):
```typescript
const wss = new WebSocketServer({ 
  server: httpServer,
  path: '/ws'
});

// Broadcast to all connected clients
function broadcast(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}
```

**Client Side** (`client/src/lib/useWebSocket.ts`):
```typescript
const socket = new WebSocket(wsUrl);

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  // Handle message types:
  // - NEW_REPORT
  // - REPORT_VERIFIED
  // - RESOURCE_REQUEST
  // - AID_OFFERED
};
```

### Message Types

1. **NEW_REPORT**: New disaster report submitted
2. **REPORT_VERIFIED**: Report verification count updated
3. **RESOURCE_REQUEST**: New resource request
4. **AID_OFFERED**: New aid offer available
5. **STATUS_UPDATE**: Status change on any entity

### Use Cases

- Live dashboard updates without refreshing
- Instant notification of new reports
- Real-time resource matching alerts
- Verification count updates

---

## API Endpoints

### Authentication Endpoints

```
POST   /api/auth/login           # Initiate login
GET    /api/auth/callback        # OAuth callback
POST   /api/auth/logout          # End session
GET    /api/auth/user            # Get current user
POST   /api/auth/select-role     # Set user role
GET    /api/admin/users          # Get all users (admin)
PATCH  /api/admin/users/:id/role # Update user role (admin)
```

### Report Endpoints

```
GET    /api/reports              # List all reports (with filters)
POST   /api/reports              # Create new report
GET    /api/reports/:id          # Get single report
POST   /api/reports/:id/verify   # Verify a report
PATCH  /api/reports/:id/flag     # Flag report (admin)
PATCH  /api/reports/:id/assign   # Assign to volunteer (admin)
PATCH  /api/reports/:id/notes    # Add admin notes (admin)
PATCH  /api/reports/:id/status   # Update status (admin)
```

### Resource Endpoints

```
GET    /api/resource-requests    # List resource requests
POST   /api/resource-requests    # Create request
PATCH  /api/resource-requests/:id # Update request

GET    /api/aid-offers           # List aid offers
POST   /api/aid-offers           # Create offer
PATCH  /api/aid-offers/:id       # Update offer
POST   /api/aid-offers/:id/commit # Commit to request
```

### Analytics Endpoints

```
GET    /api/analytics/summary           # Summary metrics
GET    /api/analytics/disaster-frequency # Disaster counts by type
GET    /api/analytics/geographic-impact # Geographic data
```

### Upload Endpoints

```
POST   /api/upload               # Upload media file
```

---

## Frontend Architecture

### State Management

**TanStack Query** handles all server state:

```typescript
// Queries (GET requests)
const { data, isLoading } = useQuery({
  queryKey: ['/api/reports'],
  // Uses default fetcher
});

// Mutations (POST/PATCH/DELETE)
const mutation = useMutation({
  mutationFn: (data) => apiRequest('/api/reports', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ 
      queryKey: ['/api/reports'] 
    });
  }
});
```

### Routing

**Wouter** for client-side routing:

```typescript
<Route path="/" component={Dashboard} />
<Route path="/report" component={ReportEmergency} />
<Route path="/map" component={MapView} />
```

**Authentication Guards**:
```typescript
if (!user) return <Redirect to="/login" />;
if (!user.role) return <Redirect to="/select-role" />;
```

### Form Handling

**React Hook Form + Zod**:

```typescript
const form = useForm({
  resolver: zodResolver(insertReportSchema),
  defaultValues: { ... }
});

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField name="type" ... />
  </form>
</Form>
```

### UI Components

**shadcn/ui Pattern**:
- Radix UI primitives (accessibility built-in)
- Styled with Tailwind CSS
- Customizable through CSS variables
- Dark mode support via class toggle

---

## Data Flow Diagrams

### Report Submission Flow

```
User fills form
      ↓
Captures GPS (browser geolocation API)
      ↓
Uploads media → S3 Storage → Returns URLs
      ↓
Submits to /api/reports
      ↓
Backend validates with Zod schema
      ↓
Calls OpenAI API for validation score
      ↓
Saves to database (Drizzle ORM)
      ↓
Broadcasts via WebSocket
      ↓
All clients receive update
      ↓
TanStack Query cache invalidates
      ↓
UI updates automatically
```

### AI Validation Process

```
Report submitted
      ↓
Extract: type, severity, description, location
      ↓
Construct prompt for GPT-4o-mini
      ↓
Ask AI to assess legitimacy (0-1 score)
      ↓
AI considers: coherence, location match, severity appropriateness
      ↓
Return score (e.g., 0.85 = 85% confident it's real)
      ↓
Store in aiValidationScore field
      ↓
Display to admins for moderation decisions
```

### Resource Matching Flow

```
Volunteer offers aid → Creates aid offer
      ↓
Admin/Volunteer navigates to matching interface
      ↓
Selects a resource request
      ↓
Calls /api/aid-offers/match-requests with AI
      ↓
AI analyzes: type match, location proximity, quantity
      ↓
Returns ranked list of suitable offers
      ↓
User commits specific offer to request
      ↓
Updates both records: request.status = committed, offer.status = committed
      ↓
WebSocket notifies all parties
      ↓
Tracking until delivered
```

### Admin User Management Flow

```
Admin navigates to Admin Dashboard → Users tab
      ↓
Frontend queries /api/admin/users
      ↓
Server checks: requireRole(['admin'])
      ↓
Returns all users from database
      ↓
Admin clicks "Change Role" on a user
      ↓
Dialog opens with role selector
      ↓
Admin selects new role and confirms
      ↓
Frontend sends PATCH /api/admin/users/:id/role
      ↓
Server validates:
  - Is requester admin? ✓
  - Is requester trying to demote self? ✗ Block
  - Is new role valid? ✓
      ↓
Update user.role in database
      ↓
Return updated user
      ↓
TanStack Query invalidates cache
      ↓
UI shows updated role badge
```

---

## Key Technologies Explained

### Core Technologies

#### Frontend Stack
- **React 18.3.1** - Component-based UI library with hooks
- **TypeScript 5.6.3** - Type-safe JavaScript for better DX
- **Vite 5.4.20** - Fast build tool with instant HMR
- **Wouter 3.3.5** - Lightweight routing (1.6KB)
- **TanStack Query 5.60.5** - Server state management and caching
- **shadcn/ui + Radix UI** - Accessible component system
- **Tailwind CSS 3.4.17** - Utility-first CSS framework

#### Backend Stack
- **Express.js 4.21.2** - Web server framework
- **TypeScript 5.6.3** - Type-safe server code
- **Drizzle ORM 0.39.1** - Type-safe SQL ORM
- **PostgreSQL (Neon)** - Serverless database
- **WebSocket (ws 8.18.0)** - Real-time communication
- **JWT (jsonwebtoken 9.0.2)** - Authentication tokens
- **bcryptjs 3.0.2** - Password hashing

#### AI & ML
- **OpenAI SDK 6.7.0** - GPT-4o-mini integration
- **TensorFlow.js 4.22.0** - Browser-based ML
- **MobileNet 2.1.1** - Image classification

#### Security & Middleware
- **Helmet.js 8.1.0** - Security headers (CSP, HSTS)
- **CORS 2.8.5** - Cross-origin protection
- **express-rate-limit 8.1.0** - API rate limiting
- **csurf 1.2.2** - CSRF protection
- **express-mongo-sanitize 2.2.0** - NoSQL injection prevention

#### Storage & Media
- **Google Cloud Storage 7.17.2** - S3-compatible object storage
- **Uppy 5.x** - File upload widget with S3 support
- **Sharp 0.34.4** - Image processing and optimization

#### Visualization
- **Leaflet 1.9.4** - Interactive maps
- **React Leaflet 4.2.1** - React wrapper for Leaflet
- **Leaflet.heat 0.2.0** - Heatmap visualization
- **Recharts 2.15.2** - Chart library for analytics

#### Forms & Validation
- **React Hook Form 7.55.0** - Form state management
- **Zod 3.24.2** - Schema validation
- **@hookform/resolvers 3.10.0** - Zod integration

#### Utilities
- **date-fns 3.6.0** - Date manipulation
- **Framer Motion 11.13.1** - Animations
- **memoizee 0.4.17** - Function memoization
- **compression 1.8.1** - Gzip compression

### Technology Deep Dive

#### Drizzle ORM
- **Type-safe** database queries with full TypeScript support
- Schema defined in TypeScript (`shared/schema.ts`)
- Automatic migration generation with Drizzle Kit
- Zod integration for validation via `drizzle-zod`
- No code generation required
- SQL-like syntax with type inference

#### TanStack Query
- **Server state management** for all API calls
- Automatic caching with configurable TTL
- Background refetching and revalidation
- Optimistic updates for better UX
- Query invalidation on mutations
- Loading and error states
- Pagination and infinite scroll support

#### Wouter
- **Lightweight routing** library (1.6KB gzipped)
- Hook-based API (`useLocation`, `useRoute`)
- No dependencies
- Perfect for single-page apps
- Supports nested routes and redirects
- Server-side rendering compatible

#### shadcn/ui
- **Copy-paste components** (not an npm package)
- Built on Radix UI primitives
- Fully customizable via Tailwind
- Accessible by default (ARIA compliant)
- Dark mode support
- 50+ components available

#### Uppy
- **File upload** widget with beautiful UI
- S3 multipart upload support
- Progress tracking and resumable uploads
- Drag-and-drop interface
- Image previews and cropping
- File validation and restrictions

#### Leaflet
- **Interactive maps** with OpenStreetMap tiles
- Custom marker icons by severity
- Marker clustering for performance
- Heatmap layer with leaflet.heat
- Mobile-friendly touch gestures
- Filter controls and timeline playback

---

## Environment Setup

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host/db

# Authentication (Replit Auth)
ISSUER_URL=https://replit.com
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret

# AI Integration
OPENAI_API_KEY=sk-...

# Object Storage (auto-configured in Replit)
BUCKET_NAME=...
BUCKET_HOST=...
ACCESS_KEY_ID=...
SECRET_ACCESS_KEY=...

# Session
SESSION_SECRET=random_string_here
ENCRYPTION_KEY=32_byte_encryption_key
```

---

## Deployment Notes

### Build Process

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Build for production
npm run build

# Start production server
npm start
```

### Production Checklist

- [ ] Set all environment variables
- [ ] Configure production database
- [ ] Set secure SESSION_SECRET
- [ ] Set ENCRYPTION_KEY for production
- [ ] Configure S3 bucket CORS
- [ ] Enable HTTPS
- [ ] Set up database backups
- [ ] Configure rate limiting
- [ ] Test all authentication flows
- [ ] Verify admin role provisioning

---

## Recent Updates (November 2025)

### Authentication Migration
- Migrated from Replit Auth (OAuth) to **JWT-based authentication**
- Access tokens (15min expiry) + Refresh tokens (7 days)
- Token storage in localStorage + httpOnly cookies
- New endpoints: `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`

### Identity Verification System
- **Email OTP verification** (6-digit code, 10min expiry)
- **Phone SMS OTP verification** (6-digit code, 10min expiry)
- **Simulated Aadhaar verification** (12-digit format validation)
- Increases user trust score upon completion

### User Reputation System
- **Trust score** (0-100) based on:
  - Verified contributions (reports, resources)
  - Identity verification completion
  - Achievements and milestones
- Reputation dashboard for users
- Trust score badges throughout UI

### Advanced Features
- **Predictive Modeling**: AI-powered disaster forecasting with external APIs
- **Image Classification**: TensorFlow.js MobileNet for disaster type detection
- **Duplicate Clustering**: Non-AI clustering algorithm for duplicate reports
- **Cluster Management**: Admin UI for managing duplicate groups

### Performance Enhancements
- **In-memory caching** with memoizee (LRU cache)
- **Pagination** across all list endpoints
- **Database indexes** on frequently queried fields
- **Response compression** (gzip for responses > 1KB)
- **Cache invalidation** on data mutations

### Security Hardening
- **Rate limiting** on all critical endpoints
- **Audit logging** for all auth events
- **WebSocket encryption** (optional AES-GCM)
- **CSRF protection** with csurf middleware
- **Input sanitization** against NoSQL injection
- **Security headers** via Helmet.js

---

## Development Workflow

### Making Changes

1. **Schema Changes**:
   - Edit `shared/schema.ts`
   - Run `npm run db:push` (or `npm run db:push --force` if needed)
   - Update affected components
   - Update types in frontend/backend

2. **New Feature**:
   - Add backend route in `/server/routes`
   - Update storage layer if needed
   - Create frontend page in `/client/src/pages`
   - Add route in `App.tsx`
   - Update navigation if needed

3. **UI Components**:
   - Check if shadcn component exists
   - Add via npx shadcn-ui@latest add [component]
   - Customize styling in component file

### Testing

1. **Manual Testing**:
   - Create test users with different roles
   - Test each feature as each role
   - Verify real-time updates
   - Test on mobile viewport

2. **Database Testing**:
   - Use Drizzle Studio: `npm run db:studio`
   - Inspect tables and relationships
   - Verify constraints

---

## Troubleshooting

### Common Issues

**WebSocket not connecting**:
- Check if server is running
- Verify WebSocket path (/ws)
- Check browser console for errors

**Session not persisting**:
- Verify DATABASE_URL is correct
- Check sessions table exists
- Verify cookie settings

**Media upload failing**:
- Check S3 credentials
- Verify bucket CORS policy
- Check file size limits

**AI validation not working**:
- Verify OPENAI_API_KEY
- Check API rate limits
- Review prompt in code

---

## Performance Considerations

1. **Query Optimization**:
   - Indexes on frequently queried fields
   - Limit results with pagination
   - Use query filters to reduce data

2. **Caching Strategy**:
   - TanStack Query caches all GET requests
   - Invalidate specific keys on mutations
   - Stale time configured per query

3. **Real-time Efficiency**:
   - WebSocket only for critical updates
   - Batch notifications where possible
   - Debounce high-frequency events

4. **Image Optimization**:
   - Compress images before upload
   - Use S3 CDN for delivery
   - Lazy load images on map

---

## Security Best Practices

1. **Authentication**: Always use session-based auth, never JWTs in localStorage
2. **Authorization**: Check roles on backend, never trust frontend
3. **Input Validation**: Validate all inputs with Zod schemas
4. **SQL Injection**: Use Drizzle ORM (parameterized queries)
5. **XSS Prevention**: React auto-escapes content
6. **CSRF Protection**: Enabled via csurf middleware
7. **Secrets**: Never commit secrets, use environment variables

---

## Future Enhancements

Potential features for expansion:
- SMS notifications via Twilio
- Push notifications for mobile
- Offline support with service workers
- Multi-language support (i18n)
- Advanced analytics with ML predictions
- Integration with government emergency systems
- Mobile apps (React Native)
- Geofencing for targeted alerts

---

**Last Updated**: October 29, 2025
**Version**: 1.0.0
**Maintainer**: Development Team
