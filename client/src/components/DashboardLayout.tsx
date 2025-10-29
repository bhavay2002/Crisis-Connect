import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import RoleBadge from "@/components/RoleBadge";
import TrustScoreBadge from "@/components/TrustScoreBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  AlertTriangle,
  PlusCircle,
  FileText,
  Users,
  BarChart3,
  Bell,
  User,
  Settings,
  LogOut,
  Moon,
  Sun,
  Map as MapIcon,
  Package,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["citizen", "volunteer", "ngo", "admin"] },
  { title: "Active Reports", url: "/reports", icon: AlertTriangle, roles: ["citizen", "volunteer", "ngo", "admin"] },
  { title: "Interactive Map", url: "/map", icon: MapIcon, roles: ["citizen", "volunteer", "ngo", "admin"] },
  { title: "Submit Report", url: "/submit", icon: PlusCircle, roles: ["citizen", "volunteer", "ngo", "admin"] },
  { title: "Resource Requests", url: "/resource-requests", icon: Package, roles: ["citizen", "volunteer", "ngo", "admin"] },
  { title: "Resource Management", url: "/resource-management", icon: Package, roles: ["ngo", "admin"] },
  { title: "Analytics", url: "/analytics", icon: BarChart3, roles: ["admin"] },
  { title: "My Reports", url: "/my-reports", icon: FileText, roles: ["citizen", "volunteer", "ngo", "admin"] },
  { title: "Response Teams", url: "/teams", icon: Users, roles: ["volunteer", "ngo", "admin"] },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();
  const [isDark, setIsDark] = useState(false);
  const [notifications] = useState(3);
  const { user } = useAuth();

  const { data: reputation } = useQuery({
    queryKey: ["/api/reputation/me"],
    enabled: !!user,
  });

  const filteredMenuItems = menuItems.filter((item) =>
    item.roles.includes(user?.role || "citizen")
  );

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
    console.log("Theme toggled:", !isDark ? "dark" : "light");
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-lg font-bold px-4 py-4">
                Crisis Connect
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <Link href={item.url}>
                        <SidebarMenuButton
                          isActive={location === item.url}
                          data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <item.icon className="w-5 h-5" />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between h-16 px-4 border-b gap-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                data-testid="button-theme-toggle"
              >
                {isDark ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="relative"
                data-testid="button-notifications"
                onClick={() => console.log("Notifications clicked")}
              >
                <Bell className="w-5 h-5" />
                {notifications > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-9 w-9 rounded-full"
                    data-testid="button-user-menu"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user?.profileImageUrl || ""} alt={user?.name || "User"} />
                      <AvatarFallback>
                        {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.name || "User"}</p>
                      <p className="text-xs text-muted-foreground">
                        {user?.email || ""}
                      </p>
                      <div className="flex gap-2 pt-1 flex-wrap">
                        {user?.role && <RoleBadge role={user.role} size="sm" />}
                        {reputation && (
                          <TrustScoreBadge 
                            score={reputation.trustScore} 
                            size="sm" 
                            showLabel={false}
                          />
                        )}
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <Link href="/select-role">
                    <DropdownMenuItem data-testid="menu-change-role">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Change Role</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem data-testid="menu-settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/api/logout" data-testid="menu-logout">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
