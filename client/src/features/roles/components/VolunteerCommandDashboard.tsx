/**
 * VolunteerCommandDashboard — task-driven, action speed.
 *
 * Design philosophy: Inbox Zero for tasks.
 * Volunteers need to:
 *   - See what needs doing NOW (sorted by severity + urgency)
 *   - Accept and act with one click
 *   - Navigate without cognitive overload
 *
 * Layout: Task queue (left 380px) + contextual info (right)
 */
import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, MapPin, Clock, Navigation,
  Package, Droplet, Home, Plus, Shirt, HelpCircle, Heart, Users,
  Zap, Shield, ChevronRight, CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth }   from "@/hooks/useAuth";
import { useToast }  from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { timeAgo }    from "@/shared/utils/format";
import { useCrisisRealtime } from "@/features/crisis";
import { SeverityBadge, EmptyState, StatCard } from "@/components/ds";
import { MOTION } from "@/lib/motion";
import type { ResourceRequest, AidOffer, DisasterReport } from "@shared/schema";

const RESOURCE_ICONS: Record<string, any> = {
  food: Package, water: Droplet, shelter: Home,
  medical: Plus, clothing: Shirt, other: HelpCircle,
};

const URGENCY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

const URGENCY_STYLE: Record<string, { badge: string; bar: string; dot: string }> = {
  critical: { badge: "bg-red-500/10 text-red-500 border-red-500/20",    bar: "bg-red-500",    dot: "bg-red-500 animate-pulse" },
  high:     { badge: "bg-orange-500/10 text-orange-500 border-orange-500/20", bar: "bg-orange-500", dot: "bg-orange-500" },
  medium:   { badge: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", bar: "bg-yellow-500", dot: "bg-yellow-500" },
  low:      { badge: "bg-blue-500/10 text-blue-500 border-blue-500/20",   bar: "bg-blue-500",   dot: "bg-blue-500"   },
};

const TABS = [
  { id: "tasks",   label: "Tasks",    icon: AlertTriangle },
  { id: "reports", label: "Verify",   icon: Shield        },
  { id: "offers",  label: "My Offers",icon: Heart         },
] as const;

type Tab = typeof TABS[number]["id"];

export function VolunteerCommandDashboard() {
  const [, setLocation] = useLocation();
  const { user }        = useAuth();
  const { toast }       = useToast();
  const queryClient     = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("tasks");
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());

  const { data: requests = [] } = useQuery<ResourceRequest[]>({ queryKey: ["/api/resource-requests"] });
  const { data: myOffers = [] }  = useQuery<AidOffer[]>({ queryKey: ["/api/aid-offers/mine"] });
  const { data: reportsResponse } = useQuery<{ data: DisasterReport[]; pagination: any }>({ queryKey: ["/api/reports"] });
  const reports = reportsResponse?.data || [];

  useCrisisRealtime({
    onNewReport: () => queryClient.invalidateQueries({ queryKey: ["/api/resource-requests"] }),
  });

  const pendingTasks = useMemo(
    () => [...requests.filter(r => r.status === "pending")]
      .sort((a, b) =>
        (URGENCY_ORDER[a.urgency as keyof typeof URGENCY_ORDER] ?? 9) -
        (URGENCY_ORDER[b.urgency as keyof typeof URGENCY_ORDER] ?? 9)
      ),
    [requests]
  );

  const verifyQueue = useMemo(
    () => reports.filter(r => !r.confirmedBy && r.status === "reported" && r.verificationCount >= 3).slice(0, 10),
    [reports]
  );

  const criticalCount = pendingTasks.filter(t => t.urgency === "critical").length;
  const myActive = requests.filter(r => r.status === "in_progress").length;

  const handleAccept = useCallback(async (taskId: string) => {
    setAcceptedIds(s => new Set([...s, taskId]));
    toast({ title: "Task accepted — navigate to location" });
  }, [toast]);

  const handleComplete = useCallback(async (taskId: string) => {
    try {
      await apiRequest(`/api/resource-requests/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "fulfilled" }),
      });
      toast({ title: "Task marked complete" });
      queryClient.invalidateQueries({ queryKey: ["/api/resource-requests"] });
      setAcceptedIds(s => { const n = new Set(s); n.delete(taskId); return n; });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }, [queryClient, toast]);

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* ── Top command bar ── */}
      <div className="px-5 py-3 border-b border-border/60 bg-slate-950 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-orange-500" />
          <span className="font-black text-sm">Volunteer Hub</span>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          {criticalCount > 0 && (
            <motion.div
              animate={MOTION.criticalPulse}
              className="flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              {criticalCount} CRITICAL
            </motion.div>
          )}
          <div className="text-xs text-muted-foreground">
            {myActive > 0
              ? <span className="text-green-500 font-semibold">{myActive} active</span>
              : <span>No active assignments</span>}
          </div>
          <Button size="sm" className="h-7 text-xs bg-orange-600 hover:bg-orange-700 border-0"
            onClick={() => setLocation("/submit-aid-offer")}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Offer Aid
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Task sidebar ── */}
        <div className="w-80 border-r border-border/60 flex flex-col flex-shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-border/60 flex-shrink-0">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
                  activeTab === id ? "border-b-2 border-orange-500 text-orange-500" : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
                {id === "tasks" && pendingTasks.length > 0 && (
                  <span className="ml-0.5 w-4 h-4 rounded-full bg-orange-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {Math.min(pendingTasks.length, 99)}
                  </span>
                )}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1">
            <AnimatePresence mode="wait">
              {/* ── Tasks tab ── */}
              {activeTab === "tasks" && (
                <motion.div key="tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {pendingTasks.length === 0 ? (
                    <EmptyState icon={CheckCheck} title="Inbox zero" description="All tasks are covered" size="sm" />
                  ) : (
                    <div className="divide-y divide-border/40">
                      {pendingTasks.slice(0, 20).map((task) => {
                        const ug   = URGENCY_STYLE[task.urgency] || URGENCY_STYLE.low;
                        const Icon = RESOURCE_ICONS[task.resourceType] || HelpCircle;
                        const isAccepted = acceptedIds.has(task.id);
                        return (
                          <motion.div key={task.id}
                            initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                            className={`p-3 hover:bg-muted/20 transition-colors ${task.urgency === "critical" ? "bg-red-500/5" : ""}`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className={`w-1.5 flex-shrink-0 self-stretch rounded-full mt-0.5 ${ug.bar}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <SeverityBadge level={task.urgency as any} size="sm" dot={false} />
                                  <span className="text-[10px] text-muted-foreground capitalize">{task.resourceType}</span>
                                </div>
                                <p className="text-xs font-semibold truncate">{task.quantity} units • {task.location.slice(0, 28)}</p>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  {timeAgo(task.createdAt)}
                                </div>
                                <div className="flex gap-1.5 mt-2">
                                  {!isAccepted ? (
                                    <>
                                      <button onClick={() => handleAccept(task.id)}
                                        className="flex-1 text-[11px] font-bold py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors">
                                        Accept
                                      </button>
                                      <button onClick={() => setLocation("/resource-requests")}
                                        className="px-2 py-1 rounded-lg border border-border hover:bg-muted text-[11px] text-muted-foreground">
                                        <Navigation className="w-3 h-3" />
                                      </button>
                                    </>
                                  ) : (
                                    <button onClick={() => handleComplete(task.id)}
                                      className="flex-1 text-[11px] font-bold py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center justify-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Complete
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Verify tab ── */}
              {activeTab === "reports" && (
                <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="divide-y divide-border/40">
                  {verifyQueue.length === 0 ? (
                    <EmptyState icon={CheckCircle2} title="All verified" description="No reports need verification" size="sm" />
                  ) : verifyQueue.map(r => (
                    <div key={r.id} className="p-3 hover:bg-muted/20 transition-colors">
                      <p className="text-xs font-semibold truncate">{r.title}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{r.location.slice(0, 22)}
                        </span>
                        <button onClick={() => setLocation(`/reports/${r.id}`)}
                          className="text-[11px] font-bold text-orange-500 hover:underline">
                          Verify →
                        </button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* ── Offers tab ── */}
              {activeTab === "offers" && (
                <motion.div key="offers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="divide-y divide-border/40">
                  {myOffers.length === 0 ? (
                    <EmptyState icon={Heart} title="No active offers" description="Offer resources to people in need" size="sm"
                      action={<button onClick={() => setLocation("/submit-aid-offer")} className="text-xs text-orange-500 font-semibold hover:underline">+ Create offer</button>} />
                  ) : myOffers.map(o => (
                    <div key={o.id} className="p-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold capitalize">{o.resourceType} · {o.quantity}</p>
                        <Badge variant="outline" className="text-[10px] h-4">{o.status}</Badge>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-muted-foreground">{o.location.slice(0, 25)}</span>
                        <button onClick={() => setLocation(`/aid-offers/${o.id}/matches`)}
                          className="text-[11px] font-bold text-orange-500 hover:underline">
                          Matches →
                        </button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </ScrollArea>
        </div>

        {/* ── Main area ── */}
        <div className="flex-1 flex flex-col overflow-auto p-5 gap-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Pending Tasks" value={pendingTasks.length} icon={AlertTriangle} severity="high" />
            <StatCard label="Critical"      value={criticalCount}        icon={Zap}           severity={criticalCount > 0 ? "critical" : undefined} />
            <StatCard label="My Active"     value={myActive}             icon={Navigation} />
            <StatCard label="My Offers"     value={myOffers.length}      icon={Heart} />
          </div>

          {/* Critical tasks highlight */}
          {criticalCount > 0 && (
            <motion.div
              {...MOTION.fadeUp}
              className="rounded-xl border border-red-500/20 bg-red-500/5 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <motion.div animate={MOTION.criticalPulse}>
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </motion.div>
                <span className="text-sm font-bold text-red-500">{criticalCount} CRITICAL Task{criticalCount > 1 ? "s" : ""} Need Immediate Response</span>
              </div>
              <div className="space-y-2">
                {pendingTasks.filter(t => t.urgency === "critical").slice(0, 3).map(t => (
                  <div key={t.id} className="flex items-center gap-3 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <span className="flex-1 truncate font-medium capitalize">{t.resourceType} · {t.quantity} units · {t.location.slice(0, 30)}</span>
                    <button onClick={() => { setActiveTab("tasks"); handleAccept(t.id); }}
                      className="text-xs font-bold text-red-500 hover:underline flex-shrink-0">
                      Accept
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Navigation shortcuts */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "All Resource Requests", url: "/resource-requests",  icon: Package,       desc: "See full pending list"           },
              { label: "Aid Matching",           url: "/aid-matching",        icon: Zap,           desc: "AI-powered resource matching"    },
              { label: "Report Incidents",       url: "/submit",              icon: AlertTriangle, desc: "File a new emergency report"     },
              { label: "Team Messages",          url: "/messages",            icon: Users,         desc: "Coordinate with your team"       },
            ].map(({ label, url, icon: Icon, desc }) => (
              <motion.button key={url} onClick={() => setLocation(url)}
                {...MOTION.cardHover}
                className="flex items-center gap-3 p-3.5 rounded-xl border bg-slate-900/40 hover:bg-slate-800/60 transition-colors text-left group">
                <Icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
