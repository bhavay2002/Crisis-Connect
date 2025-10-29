# Crisis Connect

A real-time disaster management and emergency response coordination platform designed to save lives and streamline relief operations during natural disasters and emergencies.

## Overview

Crisis Connect connects disaster victims, volunteers, NGOs, and government agencies in a unified platform for rapid incident reporting, resource coordination, and emergency response management.

## Key Features

### For Citizens
- **Emergency Reporting**: Submit disaster reports with GPS location, photos, and videos
- **AI Validation**: Automatic detection of duplicate and potentially fake reports
- **Resource Requests**: Request emergency resources (food, water, shelter, medical supplies)
- **Real-time Updates**: Live notifications about response activities

### For Volunteers & NGOs
- **Volunteer Hub**: Manage aid offers and match with resource requests
- **AI-Powered Matching**: Smart matching between available resources and urgent needs
- **Verification System**: Crowd-sourced verification of incident reports
- **Resource Tracking**: Track committed resources from offer to delivery

### For Administrators
- **User Management**: Assign roles and manage platform access
- **Report Moderation**: Flag, verify, and manage disaster reports
- **Analytics Dashboard**: Comprehensive metrics and insights
- **Government Reports**: Export analytics data in CSV or JSON format

### Platform Features
- **Interactive Map**: Visual representation of incidents with severity indicators
- **Real-time Notifications**: WebSocket-powered live updates
- **Mobile-First Design**: Optimized for emergency situations on any device
- **Dark Mode**: Accessibility with light and dark themes

## Technology Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL (Neon serverless)
- **Authentication**: Replit Auth (OpenID Connect)
- **UI Framework**: shadcn/ui + Radix UI + Tailwind CSS
- **Real-time**: WebSocket Server
- **Storage**: Replit Object Storage (S3-compatible)
- **AI**: OpenAI GPT-4o-mini (via Replit AI Integrations)

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Replit Auth credentials
- OpenAI API access (via Replit Integration)
- Object Storage (via Replit Integration)

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `ISSUER_URL`: Replit Auth issuer URL
- `CLIENT_ID`: OAuth client ID
- `CLIENT_SECRET`: OAuth client secret
- `OPENAI_API_KEY`: OpenAI API key
- Object storage credentials (automatically configured via Replit)

4. Run database migrations:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Project Structure

```
crisis-connect/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities and hooks
│   │   └── App.tsx        # Main app component
├── server/                # Backend Express application
│   ├── routes/            # API route handlers
│   ├── storage.ts         # Database operations
│   └── index.ts           # Server entry point
├── shared/                # Shared types and schemas
│   └── schema.ts          # Database schema
└── db/                    # Database migrations
```

## Usage

### Roles and Access

1. **Citizen**: Default role for new users
   - Submit disaster reports
   - Request resources
   - Verify reports

2. **Volunteer**: For individual volunteers
   - All citizen features
   - Offer aid/resources
   - Access volunteer hub

3. **NGO**: For relief organizations
   - All volunteer features
   - Organization-level resource management

4. **Admin**: Platform administrators
   - All features
   - User management
   - Report moderation
   - Analytics export

### Submitting a Report

1. Navigate to "Report Emergency"
2. Select disaster type and severity
3. Capture GPS location (or enter manually)
4. Upload photos/videos (optional)
5. Provide description
6. Submit for AI validation

### Requesting Resources

1. Go to "Resource Requests"
2. Click "Request Resources"
3. Select resource type and urgency
4. Specify quantity and location
5. Submit request

### Offering Aid (Volunteers/NGOs)

1. Access "Volunteer Hub"
2. Navigate to "Aid Offers"
3. Click "Offer Aid"
4. Specify available resources
5. Match with pending requests

## Analytics & Reporting

Administrators can export comprehensive analytics reports including:
- Total incidents and verification rates
- Disaster frequency by type
- Geographic impact analysis
- Resource request/fulfillment metrics
- Response time analytics
- Incident hotspot identification

Export formats: CSV (for spreadsheets) or JSON (for data processing)

## Security Features

- Encrypted sessions with PostgreSQL store
- HTTPS-only cookies
- CSRF protection
- Role-based access control
- Admin self-demotion prevention
- Secure media upload with access control

## Contributing

This is a disaster management platform designed for emergency situations. All contributions should prioritize reliability, speed, and accessibility.

## License

This project is designed for humanitarian purposes to assist in disaster response and emergency management.

## Support

For technical issues or feature requests, please contact the development team.

---

**Crisis Connect** - Connecting Communities in Times of Crisis
