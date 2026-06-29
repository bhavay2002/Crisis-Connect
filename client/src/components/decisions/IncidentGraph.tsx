import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Network, AlertCircle, User, MapPin, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface GraphNode {
  id: string;
  type: "incident" | "user" | "responder" | "location";
  label: string;
  severity?: string;
  meta?: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: "REPORTED" | "RESPONDING" | "NEARBY" | "ESCALATED_TO";
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: { reportCount: number; responderCount: number; nearbyCount: number };
}

const NODE_STYLE: Record<string, { fill: string; stroke: string; icon: React.ElementType; size: number }> = {
  incident: { fill: "#dc2626", stroke: "#ef4444", icon: AlertCircle, size: 28 },
  user: { fill: "#3b82f6", stroke: "#60a5fa", icon: User, size: 22 },
  responder: { fill: "#16a34a", stroke: "#4ade80", icon: Shield, size: 22 },
  location: { fill: "#7c3aed", stroke: "#a78bfa", icon: MapPin, size: 20 },
};

const EDGE_COLOR: Record<string, string> = {
  REPORTED: "#60a5fa60",
  RESPONDING: "#4ade8060",
  NEARBY: "#fb923c60",
  ESCALATED_TO: "#a78bfa60",
};

const EDGE_DASH: Record<string, string> = {
  REPORTED: "none",
  RESPONDING: "none",
  NEARBY: "6 4",
  ESCALATED_TO: "3 3",
};

const W = 560;
const H = 360;
const CX = W / 2;
const CY = H / 2;

function radialPositions(nodes: GraphNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  const mainIncident = nodes.find((n) => n.type === "incident" && n.id.startsWith("incident-"));
  const users = nodes.filter((n) => n.type === "user");
  const responders = nodes.filter((n) => n.type === "responder");
  const nearby = nodes.filter((n) => n.type === "incident" && n !== mainIncident);
  const locations = nodes.filter((n) => n.type === "location");

  if (mainIncident) positions.set(mainIncident.id, { x: CX, y: CY });

  const placeArc = (
    group: GraphNode[],
    startAngle: number,
    endAngle: number,
    radius: number
  ) => {
    if (group.length === 0) return;
    const step = group.length === 1 ? 0 : (endAngle - startAngle) / (group.length - 1);
    group.forEach((n, i) => {
      const angle = group.length === 1 ? (startAngle + endAngle) / 2 : startAngle + step * i;
      const rad = (angle * Math.PI) / 180;
      positions.set(n.id, { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) });
    });
  };

  placeArc(users, 195, 255, 145);
  placeArc(responders, -45, 45, 145);
  placeArc(nearby, 290, 350, 165);
  placeArc(locations, 90, 130, 130);

  return positions;
}

function GraphSvg({ graph, selected, onSelect }: {
  graph: GraphData;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const positions = useMemo(() => radialPositions(graph.nodes), [graph.nodes]);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-strong">
          <feGaussianBlur stdDeviation="6" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {graph.edges.map((edge, i) => {
        const src = positions.get(edge.source);
        const tgt = positions.get(edge.target);
        if (!src || !tgt) return null;
        const isHighlighted = selected && (edge.source === selected || edge.target === selected);
        return (
          <motion.line
            key={i}
            x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
            stroke={EDGE_COLOR[edge.relation]}
            strokeWidth={isHighlighted ? 2 : 1}
            strokeDasharray={EDGE_DASH[edge.relation]}
            initial={{ opacity: 0 }}
            animate={{ opacity: isHighlighted ? 1 : 0.5 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
          />
        );
      })}

      {graph.nodes.map((node, i) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        const style = NODE_STYLE[node.type] ?? NODE_STYLE.location;
        const r = style.size / 2;
        const isSelected = selected === node.id;
        const isMain = node.type === "incident" && i === 0;

        return (
          <motion.g
            key={node.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.07, type: "spring", stiffness: 260, damping: 20 }}
            style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
            onClick={() => onSelect(isSelected ? null : node.id)}
            className="cursor-pointer"
            filter={isSelected || isMain ? "url(#glow-strong)" : "url(#glow)"}
          >
            {isMain && (
              <motion.circle
                cx={pos.x} cy={pos.y} r={r + 10}
                fill={style.fill + "15"}
                stroke={style.stroke + "30"}
                strokeWidth={1}
                animate={{ r: [r + 8, r + 14, r + 8] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              />
            )}
            <circle
              cx={pos.x} cy={pos.y} r={r}
              fill={style.fill + (isSelected ? "ff" : "cc")}
              stroke={style.stroke}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            <text
              x={pos.x}
              y={pos.y + r + 14}
              textAnchor="middle"
              fontSize={9}
              fill="#94a3b8"
              className="pointer-events-none"
            >
              {node.label.length > 16 ? node.label.slice(0, 15) + "…" : node.label}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}

export function IncidentGraph({ reportId }: { reportId?: string }) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const { data, isLoading } = useQuery<GraphData>({
    queryKey: ["/api/incidents", reportId, "graph"],
    queryFn: async () => {
      const res = await fetch(`/api/incidents/${reportId}/graph`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch graph");
      return res.json();
    },
    enabled: !!reportId,
    staleTime: 60_000,
  });

  const selectedNodeData = data?.nodes.find((n) => n.id === selectedNode);

  if (!reportId) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center">
        <Network className="w-10 h-10 text-slate-600 mb-3" />
        <p className="text-sm text-slate-400">Select an incident from the feed to view its relationship graph</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"
        />
        <p className="text-xs text-slate-500">Building incident graph…</p>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center">
        <Network className="w-8 h-8 text-slate-600 mb-2" />
        <p className="text-sm text-slate-400">No graph data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Reports", value: data.stats.reportCount, color: "text-red-400" },
          { label: "Responders", value: data.stats.responderCount, color: "text-green-400" },
          { label: "Nearby", value: data.stats.nearbyCount, color: "text-orange-400" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800/60 rounded-lg p-2">
            <p className={cn("text-lg font-black tabular-nums", s.color)}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-900/80 overflow-hidden">
        <GraphSvg graph={data} selected={selectedNode} onSelect={setSelectedNode} />
      </div>

      <AnimatePresence>
        {selectedNodeData && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="rounded-lg bg-slate-800 border border-slate-700 p-3"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: NODE_STYLE[selectedNodeData.type]?.fill }}
              />
              <span className="text-xs font-semibold text-slate-200">{selectedNodeData.label}</span>
              <span className="text-xs text-slate-500 ml-auto capitalize">{selectedNodeData.type}</span>
            </div>
            {selectedNodeData.severity && (
              <p className="text-xs text-slate-400 mt-1">Severity: <span className="capitalize">{selectedNodeData.severity}</span></p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {[
          { label: "Reported", color: EDGE_COLOR.REPORTED },
          { label: "Responding", color: EDGE_COLOR.RESPONDING },
          { label: "Nearby", color: EDGE_COLOR.NEARBY, dashed: true },
          { label: "Location", color: EDGE_COLOR.ESCALATED_TO, dashed: true },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <svg width="20" height="6">
              <line x1="0" y1="3" x2="20" y2="3" stroke={l.color} strokeWidth="1.5"
                strokeDasharray={l.dashed ? "4 3" : "none"} />
            </svg>
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
