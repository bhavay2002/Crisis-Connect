/**
 * AuthorityCommandCenter — command & coordinate.
 *
 * Design philosophy: air traffic control / military command systems.
 *   - Map is the primary surface (2/3 of screen)
 *   - Command panel on right (1/3): live incidents, dispatch, broadcast
 *   - Dark, high-contrast, information-dense
 *   - Every pixel has operational purpose
 *
 * This is forced dark regardless of app theme — authority ops run 24/7.
 */
import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { Icon } from "leaflet";
import {
  AlertTriangle, Radio, Crosshair, Clock, Users,
  ChevronRight, Activity, CheckCircle, Zap,
  Navigation, Shield, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRealtimeMessage } from "@/providers/WebSocketProvider";
import { useDecisionStore, selectEventLog } from "@/features/crisis";
import { useCrisisActions } from "@/features/crisis";
import { useCommandCenter, selectSelectedIncident } from "@/features/map";
import { useCommandMode } from "../hooks/useCommandMode";
import { timeAgo } from "@/shared/utils/format";
import { SeverityBadge, LiveIndicator, EmptyState, StatCard } from "@/components/ds";
import { MOTION } from "@/lib/motion";
import type { DisasterReport } from "@shared/schema";
import "leaflet/dist/leaflet.css";

const SEV_COLOR: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e",
};

const createIcon = (color: string, selected = false) => {
  const size = selected ? 30 : 22;
  const svg  = `<svg width="${size}" height="${Math.round(size * 1.6)}" viewBox="0 0 ${size} ${Math.round(size * 1.6)}" xmlns="http://www.w3.org/2000/svg">
    <path d="M${size/2} 0C${size*0.22} 0 0 ${size*0.22} 0 ${size/2}c0 ${size*0.33} ${size/2} ${size*1.1} ${size/2} ${size*1.1}S${size} ${size*0.83} ${size} ${size/2}C${size} ${size*0.22} ${size*0.78} 0 ${size/2} 0z" fill="${color}" ${selected ? 'stroke="#fff" stroke-width="2"' : ''}/>
    <circle cx="${size/2}" cy="${size/2}" r="${selected ? 7 : 5}" fill="white"/>
  </svg>`;
  return new Icon({
    iconUrl:    `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize:   [size, Math.round(size * 1.6)],
    iconAnchor: [size / 2, Math.round(size * 1.6)],
  });
};

export function AuthorityCommandCenter() {
  const [, setLocation]  = useLocation();
  const { upvote }       = useCrisisActions();
  const eventLog         = useDecisionStore(selectEventLog);
  const selectedIncident = useCommandCenter(selectSelectedIncident);
  const { isCommandMode, criticalCount, activeCount } = useCommandMode();

  const { data: reportsResponse } = useQuery<{ data: DisasterReport[]; pagination: any }>({
    queryKey: ["/api/reports"],
  });
  const reports = reportsResponse?.data || [];
  const active  = useMemo(() => reports.filter(r => r.status !== "resolved"), [reports]);
  const mapped  = useMemo(() => active.filter(r => r.latitude && r.longitude), [active]);

  const mapCenter: [number, number] = useMemo(() => {
    if (!mapped.length) return [37.7749, -122.4194];
    const lats = mapped.map(r => parseFloat(r.latitude!));
    const lngs = mapped.map(r => parseFloat(r.longitude!));
    return [
      lats.reduce((a, b) => a + b, 0) / lats.length,
      lngs.reduce((a, b) => a + b, 0) / lngs.length,
    ];
  }, [mapped]);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100" style={{ colorScheme: "dark" }}>
      {/* ── Authority command header ── */}
      <div className="h-12 border-b border-slate-800 flex items-center px-5 gap-4 flex-shrink-0 bg-slate-950">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-500" />
          <span className="font-black text-sm tracking-wide uppercase">Authority Command</span>
        </div>
        {isCommandMode && (
          <motion.div animate={MOTION.criticalPulse}
            className="flex items-center gap-1.5 text-[11px] font-black text-red-500 bg-red-500/15 border border-red-500/30 rounded-full px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />COMMAND MODE ACTIVE
          </motion.div>
        )}
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <LiveIndicator label="Live" size="sm" />
            <span>{activeCount} active incidents</span>
            {criticalCount > 0 && (
              <motion.span animate={MOTION.criticalPulse} className="text-red-500 font-bold">
                {criticalCount} CRITICAL
              </motion.span>
            )}
          </div>
          <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700 border-0"
            onClick={() => setLocation("/broadcast-alerts")}>
            <Radio className="w-3.5 h-3.5 mr-1" />Broadcast
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs border-slate-700 hover:bg-slate-800"
            onClick={() => setLocation("/map")}>
            Full Map
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── MAP — primary surface ── */}
        <div className="flex-1 relative" style={{ minWidth: 0 }}>
          <MapContainer
            center={mapCenter} zoom={mapped.length > 0 ? 10 : 4}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution=""
              className="grayscale brightness-50 invert"
            />
            {mapped.map(r => {
              const lat = parseFloat(r.latitude!);
              const lng = parseFloat(r.longitude!);
              const isSelected = selectedIncident?.id === r.id;
              return (
                <Marker key={r.id} position={[lat, lng]}
                  icon={createIcon(SEV_COLOR[r.severity] || "#64748b", isSelected)}>
                  <Popup className="dark-popup">
                    <div className="min-w-[160px] bg-slate-900 text-slate-100 rounded-lg p-2.5">
                      <p className="font-bold text-sm mb-1">{r.title}</p>
                      <p className="text-xs text-slate-400 mb-2">{r.location}</p>
                      <div className="flex gap-1.5">
                        <button onClick={() => setLocation(`/reports/${r.id}`)}
                          className="flex-1 text-[11px] font-bold py-1 rounded bg-red-600 hover:bg-red-700 text-white">
                          Command Panel
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Overlay incident count */}
          <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
            {(["critical","high","medium","low"] as const).map(sev => {
              const count = active.filter(r => r.severity === sev).length;
              if (!count) return null;
              return (
                <div key={sev} className="flex items-center gap-2 bg-slate-900/90 backdrop-blur rounded-lg px-2 py-1 border border-slate-700">
                  <SeverityBadge level={sev} size="sm" />
                  <span className="text-xs font-black text-slate-100 tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>

          {/* Quick nav overlay */}
          <div className="absolute bottom-3 left-3 z-[1000] flex gap-2">
            {[
              { label: "Full Map",    url: "/map",       icon: Crosshair },
              { label: "Reports",    url: "/reports",   icon: AlertTriangle },
              { label: "Analytics",  url: "/analytics", icon: BarChart3 },
              { label: "Teams",      url: "/teams",     icon: Users },
            ].map(({ label, url, icon: Icon }) => (
              <button key={url} onClick={() => setLocation(url)}
                className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-700 hover:border-slate-500 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors">
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>

        {/* ── COMMAND PANEL — right 320px ── */}
        <div className="w-80 border-l border-slate-800 flex flex-col flex-shrink-0 bg-slate-950">
          {/* Live incident feed */}
          <div className="border-b border-slate-800 p-3">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Live Incidents</span>
              <button onClick={() => setLocation("/reports")}
                className="text-[10px] text-red-400 hover:text-red-300 font-semibold">
                All →
              </button>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-auto">
              {active.slice(0, 8).map(r => (
                <motion.button key={r.id}
                  initial={{ opacity: 0, x: 4 }} animate={{ opacity: 1, x: 0 }}
                  onClick={() => setLocation(`/reports/${r.id}`)}
                  className="w-full text-left flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-800/60 transition-colors group"
                >
                  <div className="w-1 flex-shrink-0 self-stretch rounded-full"
                    style={{ backgroundColor: SEV_COLOR[r.severity] || "#64748b" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{r.title}</p>
                    <p className="text-[10px] text-slate-500 truncate">{r.location}</p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-0.5 transition-colors" />
                </motion.button>
              ))}
              {active.length === 0 && (
                <EmptyState icon={CheckCircle} title="All clear" description="No active incidents" size="sm" />
              )}
            </div>
          </div>

          {/* Command actions */}
          <div className="border-b border-slate-800 p-3">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2.5">Command Actions</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Broadcast Alert", url: "/broadcast-alerts", icon: Radio,     danger: true  },
                { label: "Dispatch Team",   url: "/teams",            icon: Navigation, danger: false },
                { label: "AI Copilot",      url: "/copilot",          icon: Zap,        danger: false },
                { label: "Monitoring",      url: "/monitoring",       icon: Activity,   danger: false },
              ].map(({ label, url, icon: Icon, danger }) => (
                <motion.button key={url} onClick={() => setLocation(url)}
                  {...MOTION.pressable}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-center text-[11px] font-semibold transition-colors ${
                    danger
                      ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      : "border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                  }`}>
                  <Icon className="w-4 h-4" />{label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Event timeline feed */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Event Feed</span>
            </div>
            <ScrollArea className="flex-1">
              <div className="divide-y divide-slate-800/60">
                {eventLog.length === 0 ? (
                  <EmptyState icon={Clock} title="Awaiting events" size="sm" />
                ) : eventLog.map(e => (
                  <div key={e.id} className="px-3 py-2 hover:bg-slate-900/40 transition-colors">
                    <div className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                        e.type === "sos_alert" ? "bg-red-500 animate-pulse" :
                        e.type === "new_report" ? "bg-orange-500" :
                        e.type === "broadcast" ? "bg-yellow-500" : "bg-slate-500"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-slate-200 leading-tight">{e.message}</p>
                        {e.subtext && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{e.subtext}</p>}
                        <p className="text-[9px] text-slate-600 mt-0.5">{timeAgo(new Date(e.timestamp).toISOString())}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Platform stats strip */}
          <div className="border-t border-slate-800 px-3 py-2 grid grid-cols-3 gap-2">
            {[
              { label: "Active",   value: activeCount,   color: "text-orange-400" },
              { label: "Critical", value: criticalCount, color: criticalCount > 0 ? "text-red-400" : "text-slate-400" },
              { label: "Verified", value: reports.filter(r => r.status === "verified" || r.status === "responding").length, color: "text-green-400" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <motion.p
                  key={s.value}
                  {...MOTION.springPop}
                  className={`text-base font-black tabular-nums ${s.color}`}
                >
                  {s.value}
                </motion.p>
                <p className="text-[9px] text-slate-500 uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
