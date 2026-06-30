import { Users, MessageSquare, AlertTriangle, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { ChatRoom } from "../types/chat.types";

const ROOM_ICONS: Record<string, { Icon: any; color: string; bg: string }> = {
  group:  { Icon: Users,         color: "text-purple-400", bg: "bg-purple-500/15" },
  report: { Icon: AlertTriangle, color: "text-red-400",    bg: "bg-red-500/15"    },
  direct: { Icon: MessageSquare, color: "text-blue-400",   bg: "bg-blue-500/15"   },
};

interface Props {
  rooms: ChatRoom[];
  selectedRoomId: string | null;
  onSelect: (roomId: string) => void;
  onCreateRoom: () => void;
}

export function RoomList({ rooms, selectedRoomId, onSelect, onCreateRoom }: Props) {
  return (
    <div className="w-72 border-r border-border/60 flex flex-col bg-slate-950 flex-shrink-0">
      <div className="p-4 border-b border-border/60 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-sm">Ops Channels</h2>
          <p className="text-xs text-muted-foreground">{rooms.length} room{rooms.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCreateRoom} title="New channel">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {rooms.length === 0 && (
          <div className="p-6 text-xs text-muted-foreground text-center">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No channels yet.
          </div>
        )}
        {rooms.map(room => {
          const { Icon, color, bg } = ROOM_ICONS[room.type] || ROOM_ICONS.direct;
          return (
            <button
              key={room.id}
              onClick={() => onSelect(room.id)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors border-b border-border/30 ${
                selectedRoomId === room.id ? "bg-red-600/10 border-l-2 border-l-red-600" : ""
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {room.name || (room.type === "direct" ? "Direct Message" : "Group Chat")}
                </p>
                <p className="text-xs text-muted-foreground capitalize">{room.type}</p>
              </div>
            </button>
          );
        })}
      </ScrollArea>
    </div>
  );
}
