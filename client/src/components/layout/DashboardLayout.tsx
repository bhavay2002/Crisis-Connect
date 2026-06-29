import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard, AlertTriangle, PlusCircle, FileText, Users, BarChart3,
  User, Settings, LogOut, Moon, Sun, Map as MapIcon, Package,
  Heart, Sparkles, Award, Shield, Zap, MessageSquare, Wifi, WifiOff,
  Brain, Building2, ShieldCheck, Code, Activity, Globe, ShieldAlert,
  ChevronDown, Radio, Menu, X, Layers, LineChart, Lock, Megaphone,
} from "lucide-react";
import { useLowBandwidth } from "@/context/LowBandwidthContext";
import { useOfflineSync } from "@/context/OfflineSyncContext";
import { NotificationBell } from "@/components/NotificationBell";
import { useWSContext } from "@/providers/WebSocketProvider";
import { ActionPanel } from "@/components/crisis/ActionPanel";
import { NetworkStatusBanner } from "@/components/system/NetworkStatusBanner";
import { OfflineQueueBadge }   from "@/components/system/OfflineQueueBadge";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps { children: React.ReactNode }

const NAV_GROUPS = [
  {
    label: "Emergency Ops",
    items: [
      { title: "Command Console",  url: "/command-console", icon: Shield, roles: ["admin","government","authority","super_admin"] },
      { title: "Dashboard",        url: "/dashboard",   icon: LayoutDashboard, roles: ["citizen","volunteer","ngo","admin","government","authority","super_admin"] },
      { title: "Active Reports",   url: "/reports",     icon: AlertTriangle,   roles: ["citizen","volunteer","ngo","admin","government","authority","super_admin"] },
      { title: "Interactive Map",  url: "/map",         icon: MapIcon,         roles: ["citizen","volunteer","ngo","admin","government","authority","super_admin"] },
      { title: "Submit Report",    url: "/submit",      icon: PlusCircle,      roles: ["citizen","volunteer","ngo","admin","authority","super_admin"] },
      { title: "My Reports",       url: "/my-reports",  icon: FileText,        roles: ["citizen","volunteer","ngo","admin","authority","super_admin"] },
    ],
  },
  {
    label: "Response & Aid",
    items: [
      { title: "Volunteer Hub",        url: "/dashboard",         icon: Heart,    roles: ["volunteer","ngo","admin","authority","super_admin"] },
      { title: "Aid Matching",         url: "/aid-matching",      icon: Sparkles, roles: ["volunteer","ngo","admin","authority","super_admin"] },
      { title: "Matching Engine",      url: "/matching-engine",   icon: Zap,      roles: ["volunteer","ngo","admin","authority","super_admin"] },
      { title: "Resource Requests",    url: "/resource-requests", icon: Package,  roles: ["citizen","volunteer","ngo","admin","authority","super_admin"] },
      { title: "Resource Management",  url: "/resource-management",icon: Package, roles: ["ngo","admin","authority","super_admin"] },
      { title: "Response Teams",       url: "/teams",             icon: Users,    roles: ["volunteer","ngo","admin","authority","super_admin"] },
      { title: "Alerts",               url: "/alerts",            icon: Megaphone, roles: ["ngo","admin","authority","super_admin"] },
    ],
  },
  {
    label: "AI & Intelligence",
    items: [
      { title: "Intelligence Center", url: "/intelligence",   icon: BarChart3,  roles: ["admin","government","authority","super_admin"] },
      { title: "AI Copilot",          url: "/copilot",        icon: Brain,      roles: ["citizen","volunteer","ngo","admin","government","authority","super_admin"] },
      { title: "Risk Map",            url: "/risk-map",       icon: Shield,     roles: ["volunteer","ngo","admin","government","authority","super_admin"] },
      { title: "AI Control Center",   url: "/ai-control-center", icon: ShieldCheck, roles: ["admin","government","authority","super_admin"] },
      { title: "Multimodal AI",       url: "/multimodal-ai",  icon: Brain,      roles: ["admin","authority","super_admin"] },
    ],
  },
  {
    label: "Top 1% Platform",
    items: [
      { title: "Decision Engine",   url: "/decision-engine", icon: Brain,      roles: ["admin","authority","super_admin"] },
      { title: "Digital Twin",      url: "/digital-twin",    icon: Globe,      roles: ["admin","authority","super_admin"] },
      { title: "Data Fusion",       url: "/data-fusion",     icon: Layers,     roles: ["admin","authority","super_admin"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Admin Console",      url: "/admin",                          icon: Shield,    roles: ["ngo","admin","authority","super_admin"] },
      { title: "Users",              url: "/admin?tab=users",                icon: Users,     roles: ["admin","super_admin"] },
      { title: "Organizations",      url: "/admin?tab=organizations",        icon: Building2, roles: ["ngo","admin","government","authority","super_admin"] },
      { title: "Governance",         url: "/admin?tab=governance",           icon: Lock,      roles: ["admin","super_admin"] },
      { title: "Fraud Detection",    url: "/admin?tab=fraud",                icon: ShieldAlert, roles: ["admin","authority","super_admin"] },
      { title: "Audit Trail",        url: "/admin?tab=audit",                icon: Activity,  roles: ["admin","super_admin"] },
      { title: "Platform Settings",  url: "/admin?tab=settings",             icon: Settings,  roles: ["admin","super_admin"] },
      { title: "Monitoring",         url: "/monitoring",                     icon: Activity,  roles: ["admin","government","authority","super_admin"] },
      { title: "Developer Portal",   url: "/dev-portal",                     icon: Code,      roles: ["admin","super_admin"] },
    ],
  },
  {
    label: "Personal",
    items: [
      { title: "Messages",     url: "/messages",    icon: MessageSquare, roles: ["citizen","volunteer","ngo","admin","government","authority","super_admin"] },
      { title: "My Profile",   url: "/profile",                    icon: User,       roles: ["citizen","volunteer","ngo","admin","government","authority","super_admin"] },
      { title: "Verification", url: "/profile?tab=verification",   icon: Shield,     roles: ["citizen","volunteer","ngo","admin","government","authority","super_admin"] },
      { title: "Reputation",   url: "/profile?tab=reputation",     icon: Award,      roles: ["citizen","volunteer","ngo","admin","government","authority","super_admin"] },
      { title: "Privacy & Data",url: "/profile?tab=privacy",       icon: ShieldCheck,roles: ["citizen","volunteer","ngo","admin","government","authority","super_admin"] },
    ],
  },
];

const ROLE_COLORS: Record<string, string> = {
  citizen:     "bg-slate-100 text-slate-700",
  volunteer:   "bg-green-100 text-green-700",
  ngo:         "bg-blue-100 text-blue-700",
  admin:       "bg-purple-100 text-purple-700",
  government:  "bg-orange-100 text-orange-700",
  authority:   "bg-red-100 text-red-700",
  super_admin: "bg-rose-100 text-rose-700",
};

function userInitials(name?: string | null) {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();
  const [isDark, setIsDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useAuth();
  const { isLowBandwidth, toggle: toggleBandwidth } = useLowBandwidth();
  useOfflineSync(); // keep provider subscribed for queue flushing

  // Realtime WS connection status from singleton provider
  const { isConnected: wsConnected } = useWSContext();

  const { data: reputation } = useQuery<{ trustScore: number }>({
    queryKey: ["/api/reputation/me"],
    enabled: !!user,
  });

  const userRole = user?.role || "citizen";

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  const filteredGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(userRole)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className={cn(
        "flex-shrink-0 flex flex-col bg-slate-950 text-slate-100 border-r border-white/5 transition-all duration-300 overflow-hidden",
        sidebarOpen ? "w-64" : "w-0 md:w-14"
      )}>
        {/* Logo */}
        <div className={cn(
          "flex items-center h-16 px-4 border-b border-white/5 flex-shrink-0",
          sidebarOpen ? "gap-2" : "justify-center"
        )}>
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <span className="font-black text-white text-sm tracking-tight whitespace-nowrap">
              CrisisConnect
            </span>
          )}
        </div>

        {/* WS live indicator strip */}
        {sidebarOpen && (
          <div className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium border-b border-white/5",
            wsConnected
              ? "text-green-400 bg-green-500/5"
              : "text-slate-500 bg-transparent"
          )}>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              wsConnected ? "bg-green-400 animate-pulse" : "bg-slate-600"
            )} />
            {wsConnected ? "Live updates active" : "Connecting…"}
          </div>
        )}

        {/* Nav scroll */}
        <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
          {filteredGroups.map((group) => (
            <div key={group.label} className="mb-1">
              {sidebarOpen && (
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-4 py-2 mt-1">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const itemPath = item.url.split("?")[0];
                const itemSearch = item.url.includes("?") ? item.url.split("?")[1] : null;
                const currentPath = window.location.pathname;
                const currentSearch = window.location.search.slice(1);
                const isActive = itemSearch
                  ? currentPath === itemPath && currentSearch === itemSearch
                  : (location === item.url ||
                     (item.url !== "/dashboard" && !item.url.includes("?") && location.startsWith(item.url)));

                return (
                  <Link
                    key={item.url}
                    href={item.url}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm font-medium transition-all duration-150 group",
                      isActive
                        ? "bg-red-600/90 text-white shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-white/5",
                      !sidebarOpen && "justify-center"
                    )}
                    title={!sidebarOpen ? item.title : undefined}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <item.icon className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                    )} />
                    {sidebarOpen && <span className="truncate">{item.title}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User pill */}
        {sidebarOpen && user && (
          <div className="p-3 border-t border-white/5 flex-shrink-0">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user.profileImageUrl || ""} />
                <AvatarFallback className="text-xs bg-red-600 text-white">
                  {userInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user.name || "User"}</p>
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded font-medium",
                  ROLE_COLORS[userRole] || "bg-slate-100 text-slate-700"
                )}>
                  {userRole}
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <header className="flex items-center justify-between h-16 px-4 bg-slate-950 border-b border-white/5 gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>

            {/* Breadcrumb */}
            <div className="hidden md:flex items-center gap-1.5 text-sm text-slate-400">
              <span className="font-semibold text-white capitalize">
                {location.replace("/", "").replace(/-/g, " ") || "Dashboard"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">

            {/* Trust score */}
            {reputation && (
              <div className="hidden sm:flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-full px-2.5 py-1">
                <Award className="w-3 h-3" />
                {reputation.trustScore}
              </div>
            )}

            {/* Bandwidth toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleBandwidth}
              title={isLowBandwidth ? "Low-bandwidth ON" : "Normal bandwidth"}
              data-testid="button-bandwidth-toggle"
            >
              {isLowBandwidth
                ? <WifiOff className="w-4 h-4 text-amber-500" />
                : <Wifi className="w-4 h-4" />}
            </Button>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {/* Notification bell with unread count */}
            <NotificationBell />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 px-2 gap-2 rounded-full"
                  data-testid="button-user-menu"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user?.profileImageUrl || ""} />
                    <AvatarFallback className="text-xs bg-red-600 text-white">
                      {userInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-sm">{user?.name || "User"}</p>
                    <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium w-fit",
                      ROLE_COLORS[userRole]
                    )}>
                      {userRole}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" data-testid="menu-profile">
                    <User className="mr-2 h-4 w-4" />Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/select-role" data-testid="menu-change-role">
                    <Settings className="mr-2 h-4 w-4" />Switch Role
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a
                    href="/api/logout"
                    data-testid="menu-logout"
                    className="text-red-600 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />Log out
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* System state banner — slides in when OFFLINE / DEGRADED / RECOVERING */}
        <NetworkStatusBanner />

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-slate-900">
          {children}
        </main>
      </div>

      {/* Command Action Panel — fixed bottom-right, role-gated */}
      <ActionPanel />

      {/* Offline queue badge — fixed bottom-left */}
      <OfflineQueueBadge />
    </div>
  );
}
