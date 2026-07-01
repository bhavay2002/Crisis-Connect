/**
 * RoleDashboard — the role router component.
 *
 * Each role gets a completely different UI, not just different buttons.
 * This is Role-Based UX (RB-UX), not just Role-Based Access Control (RBAC).
 *
 * | Role          | Product Surface              | Philosophy                    |
 * |---------------|------------------------------|-------------------------------|
 * | citizen/user  | CitizenDashboard             | SOS-first, minimal, calming   |
 * | volunteer/ngo | VolunteerCommandDashboard    | Task-driven, action speed     |
 * | admin/super   | → /admin redirect            | Control + analytics           |
 * | authority/gov | AuthorityCommandCenter       | Command center, map-primary   |
 *
 * The Redirect pattern for admin/super_admin preserves the existing
 * AdminDashboard (which is already excellent) instead of duplicating it.
 */
import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

// Lazy-load to keep initial bundle small — only the user's role component loads
const CitizenDashboard          = lazy(() => import("./CitizenDashboard").then(m => ({ default: m.CitizenDashboard })));
const VolunteerCommandDashboard = lazy(() => import("./VolunteerCommandDashboard").then(m => ({ default: m.VolunteerCommandDashboard })));
const AuthorityCommandCenter    = lazy(() => import("./AuthorityCommandCenter").then(m => ({ default: m.AuthorityCommandCenter })));
const AdminRedirect             = lazy(() => import("./AdminRedirect").then(m => ({ default: m.AdminRedirect })));

const ROLE_MAP: Record<string, React.ComponentType> = {
  citizen:     CitizenDashboard,
  user:        CitizenDashboard,
  volunteer:   VolunteerCommandDashboard,
  ngo:         VolunteerCommandDashboard,
  government:  AuthorityCommandCenter,
  authority:   AuthorityCommandCenter,
  admin:       AdminRedirect,
  super_admin: AdminRedirect,
};

export function RoleDashboard() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageSkeleton />;

  const role      = (user?.role || "citizen").toLowerCase();
  const Component = ROLE_MAP[role] || CitizenDashboard;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <Component />
    </Suspense>
  );
}
