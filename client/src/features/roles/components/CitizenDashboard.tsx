/**
 * CitizenDashboard — SOS-first, minimal, stress-free.
 *
 * Design philosophy: Uber emergency mode.
 * Citizens are scared. The UI should be:
 *   - Fast to use (one tap to call for help)
 *   - Clear status ("Help is on the way")
 *   - No analytics, no dashboards, no complexity
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, FileText, MessageSquare, MapPin,
  ChevronRight, Clock, CheckCircle2, Loader2,
  Phone, Heart, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/shared/utils/format";
import type { DisasterReport } from "@shared/schema";

const STATUS_INFO = {
  reported:  { label: "Report received",    icon: Clock,        color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/40",  border: "border-yellow-200 dark:border-yellow-800" },
  verified:  { label: "Verified by team",   icon: CheckCircle2, color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950/40",      border: "border-blue-200 dark:border-blue-800"     },
  responding:{ label: "Help is on the way", icon: ShieldAlert,  color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950/40",    border: "border-green-200 dark:border-green-800"   },
  resolved:  { label: "Resolved",           icon: CheckCircle2, color: "text-slate-500",  bg: "bg-slate-50 dark:bg-slate-900/40",    border: "border-slate-200 dark:border-slate-800"   },
};

const QUICK_ACTIONS = [
  { label: "Report Emergency",   url: "/submit",     icon: FileText,       color: "text-red-500",    bg: "bg-red-500/10",    desc: "File a new incident" },
  { label: "Find Resources",     url: "/resource-requests", icon: Heart,    color: "text-pink-500",   bg: "bg-pink-500/10",   desc: "Request aid or shelter" },
  { label: "Talk to AI Copilot", url: "/copilot",    icon: MessageSquare,  color: "text-purple-500", bg: "bg-purple-500/10", desc: "Get instant guidance" },
  { label: "View Live Map",      url: "/map",        icon: MapPin,         color: "text-blue-500",   bg: "bg-blue-500/10",   desc: "See nearby incidents" },
];

export function CitizenDashboard() {
  const [, setLocation] = useLocation();
  const { user }        = useAuth();
  const [sosActive, setSOSActive] = useState(false);

  const { data: myReportsResponse } = useQuery<{ data: DisasterReport[]; pagination: any }>({
    queryKey: ["/api/reports"],
    select: (d) => ({ ...d, data: d.data.filter(r => r.userId === user?.id).slice(0, 3) }),
  });
  const myReports = myReportsResponse?.data || [];

  const handleSOS = () => {
    setSOSActive(true);
    setTimeout(() => setLocation("/submit"), 600);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <div className="max-w-lg mx-auto w-full px-5 py-8 flex flex-col gap-6">

        {/* Greeting */}
        <div>
          <p className="text-sm text-muted-foreground">{greeting()}, {user?.name?.split(" ")[0] || "there"}</p>
          <h1 className="text-2xl font-black mt-0.5">How can we help?</h1>
        </div>

        {/* SOS Button — the primary action */}
        <motion.div
          animate={sosActive ? { scale: [1, 1.08, 0.96] } : {}}
          className="relative"
        >
          <motion.div
            className="absolute inset-0 rounded-2xl bg-red-500 opacity-20"
            animate={{ scale: [1, 1.12, 1], opacity: [0.2, 0, 0.2] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          />
          <button
            onClick={handleSOS}
            disabled={sosActive}
            className="relative w-full h-24 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-4 text-white shadow-lg shadow-red-500/30"
          >
            {sosActive ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-black tracking-tight">SOS — Report Emergency</p>
                  <p className="text-sm text-red-100 mt-0.5">Tap to file an emergency report</p>
                </div>
              </>
            )}
          </button>
        </motion.div>

        {/* Emergency hotline strip */}
        <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0">
            <Phone className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-orange-700 dark:text-orange-400">Emergency Hotline</p>
            <p className="text-sm font-semibold">Call 112 for life-threatening emergencies</p>
          </div>
        </div>

        {/* My active reports */}
        {myReports.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-sm">Your Reports</h2>
              <button onClick={() => setLocation("/my-reports")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                See all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {myReports.map(r => {
                const st = STATUS_INFO[r.status as keyof typeof STATUS_INFO] || STATUS_INFO.reported;
                const Icon = st.icon;
                return (
                  <button key={r.id} onClick={() => setLocation(`/reports/${r.id}`)}
                    className={`w-full text-left rounded-xl border p-3.5 flex items-start gap-3 transition-all hover:shadow-sm ${st.bg} ${st.border}`}>
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${st.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{r.title}</p>
                      <p className={`text-xs font-medium mt-0.5 ${st.color}`}>{st.label}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {timeAgo(r.createdAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="font-bold text-sm mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map(({ label, url, icon: Icon, color, bg, desc }) => (
              <button key={url} onClick={() => setLocation(url)}
                className="flex flex-col items-start gap-2.5 p-4 rounded-xl border bg-background hover:bg-muted/50 transition-all text-left active:scale-95">
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${color}`} />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Safety tips */}
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 p-4">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">Safety Reminder</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span> Report only factual information about the incident</li>
            <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span> Include your exact location for faster response</li>
            <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span> Photos help responders assess the situation faster</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
