import { MapPin, Shield, CheckCircle2, Radio } from "lucide-react";
import type { QuickActionId } from "../types/chat.types";

const ACTIONS: { id: QuickActionId; label: string; Icon: any; color: string; bg: string }[] = [
  { id: "send_location",   label: "Send Location",   Icon: MapPin,       color: "text-blue-500",   bg: "hover:bg-blue-500/10"   },
  { id: "request_backup",  label: "Request Backup",  Icon: Shield,       color: "text-orange-500", bg: "hover:bg-orange-500/10" },
  { id: "mark_resolved",   label: "Mark Resolved",   Icon: CheckCircle2, color: "text-green-500",  bg: "hover:bg-green-500/10"  },
  { id: "broadcast_alert", label: "Broadcast Alert", Icon: Radio,        color: "text-red-500",    bg: "hover:bg-red-500/10"    },
];

interface Props {
  onAction: (id: QuickActionId) => void;
  disabled?: boolean;
}

export function QuickActions({ onAction, disabled }: Props) {
  return (
    <div className="border-t border-border/60 px-4 pt-2 pb-1 flex gap-1.5 flex-shrink-0 flex-wrap">
      {ACTIONS.map(({ id, label, Icon, color, bg }) => (
        <button
          key={id}
          onClick={() => onAction(id)}
          disabled={disabled}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-border/40 bg-muted/20 ${bg} transition-colors disabled:opacity-50`}
        >
          <Icon className={`w-3.5 h-3.5 ${color}`} />
          {label}
        </button>
      ))}
    </div>
  );
}
