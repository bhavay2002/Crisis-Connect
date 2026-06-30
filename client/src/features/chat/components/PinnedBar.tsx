import { motion, AnimatePresence } from "framer-motion";
import { Pin } from "lucide-react";
import type { ChatMessage } from "../types/chat.types";

interface Props {
  messages: ChatMessage[];
}

export function PinnedBar({ messages }: Props) {
  return (
    <AnimatePresence>
      {messages.length > 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-b border-amber-500/20 bg-amber-500/5 flex-shrink-0 overflow-hidden"
        >
          <div className="px-4 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-500 mb-1">
              📌 Pinned Instructions ({messages.length})
            </p>
            <div className="space-y-0.5">
              {messages.slice(0, 3).map(msg => (
                <div key={msg.id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Pin className="w-3 h-3 mt-0.5 text-amber-400 flex-shrink-0" />
                  <span className="truncate">{msg.content}</span>
                </div>
              ))}
              {messages.length > 3 && (
                <p className="text-[10px] text-amber-500 ml-4">+{messages.length - 3} more</p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
