/**
 * AdminRedirect — immediately sends admins to /admin.
 * AdminDashboard is already a full-featured operations surface;
 * there's no need to duplicate it here.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";

export function AdminRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/admin"); }, [setLocation]);
  return null;
}
