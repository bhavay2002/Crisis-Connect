/**
 * MessageBubble — React.memo with custom equality.
 * With hundreds of messages in a chat, re-rendering ALL of them on every
 * new message is expensive. Custom compare ensures only the changed message
 * (or one whose pin/status changed) triggers a re-render.
 */
import React from "react";
import { motion } from "framer-motion";
import { Pin, Check, CheckCheck, AlertTriangle, Info } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { timeAgo } from "@/shared/utils/format";
import type { ChatMessage } from "../types/chat.types";

function StatusIcon({ status }: { status: string }) {
  if (status === "read")      return <CheckCheck className="w-3.5 h-3.5 text-blue-400" />;
  if (status === "delivered") return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />;
  return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
}

interface Props {
  msg: ChatMessage;
  isOwn: boolean;
  showAvatar: boolean;
  onPin: (messageId: string, isPinned: boolean) => void;
}

export function SystemMessageBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex justify-center my-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 border border-border/40 rounded-full px-3 py-1">
        <Info className="w-3 h-3 text-cyan-500 flex-shrink-0" />
        <span>{msg.content}</span>
      </div>
    </div>
  );
}

export function PriorityMessageBubble({ msg }: { msg: ChatMessage }) {
  const isCritical = msg.priority === "critical";
  return (
    <div className={`my-1 rounded-xl border-l-4 p-3 ${isCritical ? "border-red-500 bg-red-500/10" : "border-orange-500 bg-orange-500/10"}`}>
      <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
        {isCritical ? (
          <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          </motion.div>
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
        )}
        <span className={isCritical ? "text-red-500" : "text-orange-500"}>
          {isCritical ? "CRITICAL" : "PRIORITY"}
        </span>
      </div>
      <p className="text-sm">{msg.content}</p>
      {msg.actions?.length ? (
        <div className="flex gap-1.5 mt-2">
          {msg.actions.map(a => (
            <button key={a.id} className="text-xs font-semibold px-2 py-1 rounded-lg bg-background border hover:bg-muted transition-colors">
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MessageBubbleInner({ msg, isOwn, showAvatar, onPin }: Props) {
  if (msg.messageType === "system" || msg.messageType === "ai_assistant") {
    return <SystemMessageBubble msg={msg} />;
  }
  if (msg.isPriority) {
    return <PriorityMessageBubble msg={msg} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isOwn ? "justify-end" : "justify-start"} gap-2 group`}
    >
      {!isOwn && showAvatar && (
        <Avatar className="w-7 h-7 flex-shrink-0 mt-1">
          <AvatarFallback className="text-xs bg-slate-700">
            {msg.senderId?.slice(0, 2).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
      )}
      {!isOwn && !showAvatar && <div className="w-7" />}

      <div className={`max-w-[72%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        <div className={`relative px-3 py-2 rounded-2xl text-sm leading-relaxed ${
          isOwn ? "bg-red-600 text-white rounded-tr-sm" : "bg-slate-800 rounded-tl-sm"
        } ${msg.isPinned ? "ring-1 ring-amber-400" : ""}`}>
          {msg.content}
          {msg.isPinned && <Pin className="w-2.5 h-2.5 absolute -top-1 -right-1 text-amber-500" />}
          {msg.actions?.length ? (
            <div className="flex gap-1.5 mt-2">
              {msg.actions.map(a => (
                <button key={a.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className={`flex items-center gap-1 text-[10px] text-muted-foreground ${isOwn ? "flex-row-reverse" : ""}`}>
          <span>{timeAgo(msg.createdAt)}</span>
          {isOwn && <StatusIcon status={msg.status} />}
        </div>
      </div>

      <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity">
        <button
          onClick={() => onPin(msg.id, !msg.isPinned)}
          className="p-1 text-muted-foreground hover:text-foreground rounded"
          title={msg.isPinned ? "Unpin" : "Pin"}
        >
          <Pin className={`w-3.5 h-3.5 ${msg.isPinned ? "text-amber-500" : ""}`} />
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Custom equality — only re-render when the message itself changes.
 * Avoids re-rendering the entire message list on every new message.
 */
function areMsgEqual(prev: Props, next: Props): boolean {
  return (
    prev.msg.id       === next.msg.id &&
    prev.msg.status   === next.msg.status &&
    prev.msg.isPinned === next.msg.isPinned &&
    prev.msg.content  === next.msg.content &&
    prev.isOwn        === next.isOwn &&
    prev.showAvatar   === next.showAvatar
  );
}

export const MessageBubble = React.memo(MessageBubbleInner, areMsgEqual);
