import { Badge } from "@/components/ui/badge";
import { Shield, Users, Building2, UserCircle, Landmark } from "lucide-react";

interface RoleBadgeProps {
  role: "citizen" | "volunteer" | "ngo" | "admin" | "government" | null | undefined;
  size?: "sm" | "default";
}

const roleConfig = {
  citizen: {
    label: "Citizen",
    icon: UserCircle,
    variant: "secondary" as const,
  },
  volunteer: {
    label: "Volunteer",
    icon: Users,
    variant: "default" as const,
  },
  ngo: {
    label: "NGO",
    icon: Building2,
    variant: "default" as const,
  },
  government: {
    label: "Government",
    icon: Landmark,
    variant: "outline" as const,
  },
  admin: {
    label: "Admin",
    icon: Shield,
    variant: "destructive" as const,
  },
};

export default function RoleBadge({ role, size = "default" }: RoleBadgeProps) {
  if (!role) return null;
  
  const config = roleConfig[role];
  if (!config) return null;

  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <Badge variant={config.variant} className="gap-1" data-testid={`badge-role-${role}`}>
      <Icon className={iconSize} />
      {config.label}
    </Badge>
  );
}
