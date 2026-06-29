/**
 * Conditionally renders children based on user role.
 * Usage:
 *   <RoleGuard allow={["admin", "government"]}>...</RoleGuard>
 *   <RoleGuard atLeast="volunteer">...</RoleGuard>
 */
import type { ReactNode } from "react";
import { useAuthStore } from "@/store/authStore";

type Role = "citizen" | "volunteer" | "ngo" | "admin" | "government" | "authority" | "super_admin";

const ROLE_LEVEL: Record<Role, number> = {
  citizen: 1, volunteer: 2, ngo: 3, government: 4, authority: 5, admin: 6, super_admin: 7,
};

interface RoleGuardProps {
  children: ReactNode;
  /** Whitelist: user must have one of these roles */
  allow?: Role[];
  /** Threshold: user must have at least this role level */
  atLeast?: Role;
  /** Rendered instead of null when access is denied */
  fallback?: ReactNode;
}

export function RoleGuard({ children, allow, atLeast, fallback = null }: RoleGuardProps) {
  const role = useAuthStore((s) => s.user?.role) as Role | undefined;
  const userLevel = ROLE_LEVEL[role ?? "citizen"] ?? 1;

  if (allow && !allow.includes(role as Role)) return <>{fallback}</>;
  if (atLeast && userLevel < (ROLE_LEVEL[atLeast] ?? 1)) return <>{fallback}</>;

  return <>{children}</>;
}
