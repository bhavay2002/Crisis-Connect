# Design Guidelines: Real-Time Disaster Management Platform

## Design Approach

**Selected System**: Emergency Services Design Pattern with Material Design influences
**Justification**: This platform handles critical, time-sensitive information where clarity, accessibility, and rapid decision-making are paramount. Design inspiration drawn from emergency dispatch systems, alert platforms like FEMA, and crisis response tools.

**Core Principles**:
- Clarity over decoration: Information hierarchy must be immediately scannable
- Speed over beauty: Every interaction optimized for rapid completion
- Trust through professionalism: Visual design conveys reliability and authority
- Mobile-first: Most reports will come from smartphones in the field

---

## Typography

**Font Family**: 
- Primary: Inter (Google Fonts) - exceptional readability, modern
- Monospace: JetBrains Mono - for timestamps, coordinates, IDs

**Hierarchy**:
- H1 (Page Titles): text-4xl font-bold (36px) - Crisis Dashboard, Emergency Reports
- H2 (Section Headers): text-2xl font-semibold (24px) - Active Incidents, Recent Updates
- H3 (Card Headers): text-lg font-semibold (18px) - Report titles, location names
- Body: text-base (16px) font-normal - All content, descriptions
- Small/Meta: text-sm (14px) - Timestamps, status labels, secondary info
- Captions: text-xs (12px) - Helper text, field descriptions

**Special Typography**:
- Alert Headers: text-xl font-bold uppercase tracking-wide
- Status Labels: text-xs font-semibold uppercase tracking-wider
- Emergency Numbers/Codes: text-lg font-mono font-bold

---

## Layout System

**Spacing Units**: Tailwind units of 2, 4, 6, 8, 12, 16
- Tight spacing: p-2, gap-2 (8px) - Within compact components, mobile layouts
- Standard spacing: p-4, gap-4 (16px) - Card padding, form fields
- Generous spacing: p-6, gap-6 (24px) - Section padding on desktop
- Major sections: py-12, py-16 (48-64px) - Between major page sections

**Grid System**:
- Mobile: Single column (grid-cols-1)
- Tablet: 2 columns for reports/cards (md:grid-cols-2)
- Desktop: 3-4 columns for dashboard widgets (lg:grid-cols-3, xl:grid-cols-4)

**Container Widths**:
- Form containers: max-w-md (448px) - Login, signup, report submission
- Content areas: max-w-6xl - Main dashboard, report listings
- Full-width maps: w-full with contained controls

---

## Component Library

### Authentication Pages (Login/Signup)

**Layout**: Centered card design with split treatment
- Left side: Branding area with platform purpose statement and hero image
- Right side: Form container (max-w-md)
- Mobile: Stacked single column

**Form Elements**:
- Input fields: border-2 rounded-lg p-3 with clear labels above
- Focus states: Prominent border highlight, no subtle effects
- Primary CTA: Full-width w-full rounded-lg py-3 px-6 text-lg font-semibold
- Secondary links: text-sm underline beneath primary action
- Social auth: Full-width bordered buttons with icon + text

**Trust Elements**:
- Platform statistics: "10,000+ Lives Saved" banner
- Security badges: "256-bit Encryption" footer note
- Quick access: "Report Emergency Without Account" prominent link

### Dashboard Layout

**Structure**: 
- Top: Fixed navigation bar (h-16) with logo, search, profile, alerts icon
- Sidebar: Fixed left panel (w-64) with primary navigation on desktop, collapsible on mobile
- Main: Content area with status overview cards and active reports feed
- Right panel: Live map view or recent activity stream (w-80, optional on mobile)

**Status Overview Cards** (Dashboard top):
- Grid of 3-4 stat cards (grid-cols-1 md:grid-cols-3 lg:grid-cols-4)
- Each card: p-6 rounded-xl with large number (text-3xl font-bold) and label
- Icons: 24x24 from Heroicons positioned top-right
- Metrics: Active Reports, Verified Incidents, Response Teams, Affected Areas

### Report Cards

**Primary Report Card**:
- Container: p-4 rounded-lg border-2 with status-based left border accent (border-l-4)
- Header row: Report title (text-lg font-semibold) + timestamp (text-sm text-gray-500)
- Status badge: Inline pill (px-3 py-1 rounded-full text-xs font-semibold uppercase)
- Content: Description truncated to 2 lines with "Read more" link
- Footer row: Location badge + category tags + verification count
- Action buttons: "Verify" "Update" "Share" as text buttons with icons

**Compact List View**:
- Condensed version: p-3 with single-line title, status dot indicator, timestamp
- Used in sidebar recent activity or mobile compressed view

### Report Submission Form

**Multi-step Process**:
- Step indicator: Numbered circles with connecting lines showing progress (4 steps)
- Step 1: Emergency Type selection (grid of large icon cards)
- Step 2: Location (map picker + address autocomplete)
- Step 3: Details (textarea for description, severity selector, photo upload)
- Step 4: Review and submit

**Photo Upload**:
- Drag-and-drop zone: border-2 border-dashed rounded-lg p-8 with icon and instruction
- Thumbnail preview: grid-cols-3 gap-2 with remove buttons

### Navigation

**Top Navigation Bar**:
- Logo + platform name (left)
- Search bar (center, expandable on mobile)
- Icons: Notifications (with badge), Quick Report button, Profile avatar (right)
- Height: h-16 with shadow-md

**Sidebar Navigation**:
- Sections: Dashboard, Active Reports, Submit Report, My Reports, Response Teams, Analytics
- Active state: Background fill with left border accent
- Icons: 20x20 Heroicons preceding labels
- Collapse button on mobile (hamburger menu)

### Map Integration

**Map Container**:
- Full-height container with overlay controls
- Top-right: Filter controls (card with p-4)
- Bottom: Legend showing incident types with color coding
- Markers: Color-coded by severity/type, clustered when zoomed out
- Click behavior: Opens incident details in slide-out panel

### Alert/Notification System

**Alert Banners**:
- Full-width at top of viewport (position-fixed if critical)
- Heights: p-4 with border-l-4 accent
- Types: Critical (red accent), Warning (yellow), Info (blue), Success (green)
- Content: Icon (24x24) + message + dismissible X button

**In-app Notifications**:
- Dropdown from bell icon (w-80 max-h-96 overflow-y-auto)
- Each notification: p-3 with timestamp, message, mark-as-read state
- Unread: Slightly emphasized background

---

## Accessibility Implementation

- Minimum touch targets: 44x44px for all interactive elements
- ARIA labels on all icons and icon-only buttons
- Keyboard navigation: Full tab order, Enter/Space activation, Escape to close
- Focus indicators: 2px solid outline with offset
- Form validation: Inline error messages (text-sm) below fields with icons
- Screen reader announcements for real-time updates
- High contrast mode support: Border-based separators, not just background differences

---

## Responsive Breakpoints

**Mobile (default)**: 
- Single column layouts, stacked cards
- Bottom navigation bar for primary actions
- Condensed header with hamburger menu

**Tablet (md: 768px)**:
- 2-column grids for report cards
- Sidebar navigation appears
- Expanded form layouts

**Desktop (lg: 1024px)**:
- 3-4 column grids
- Side-by-side layouts (map + feed)
- Full dashboard with all widgets visible

---

## Images

**Hero Image (Login/Signup Pages)**:
- Large hero image showing emergency responders, community support, or disaster relief in action
- Placement: Left side of split layout (50% width on desktop)
- Treatment: Slight overlay gradient to ensure text readability
- Purpose: Build trust and convey platform mission

**Dashboard**: No hero images - utility-focused with immediate data visibility

**Report Cards**: User-uploaded incident photos as thumbnails (rounded-md, aspect-square, object-cover)

**Empty States**: Illustration showing platform usage encouragement (e.g., "No active reports - Stay safe!")