/**
 * CrisisConnect Design Tokens
 * Single source of truth for all design decisions.
 * Use these in JS/TSX; CSS equivalents live in index.css and tailwind.config.ts.
 */

// ─── Brand Colors ───────────────────────────────────────────────────────────
export const COLORS = {
  brand: {
    red:    "#dc2626", // primary action — matches tailwind red-600 / --primary
    redDim: "#ef4444", // hover state — red-500
    redDeep:"#b91c1c", // pressed state — red-700
  },

  // Semantic status — used for severity / priority / connection state
  status: {
    critical: { bg: "bg-red-500/10",    text: "text-red-500",    border: "border-red-500/25",    dot: "bg-red-500",    hex: "#ef4444" },
    high:     { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/25", dot: "bg-orange-400", hex: "#fb923c" },
    medium:   { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/25", dot: "bg-yellow-400", hex: "#facc15" },
    low:      { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/25",   dot: "bg-blue-400",   hex: "#60a5fa" },
    safe:     { bg: "bg-green-500/10",  text: "text-green-400",  border: "border-green-500/25",  dot: "bg-green-400",  hex: "#4ade80" },
    info:     { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/25",   dot: "bg-blue-400",   hex: "#60a5fa" },
    warning:  { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/25",  dot: "bg-amber-400",  hex: "#fbbf24" },
    offline:  { bg: "bg-slate-500/10",  text: "text-slate-400",  border: "border-slate-500/25",  dot: "bg-slate-400",  hex: "#94a3b8" },
  },

  // Surface layers — dark-first design system
  surface: {
    base:    "bg-slate-950", // deepest layer — app background
    raised:  "bg-slate-900", // cards, panels
    overlay: "bg-slate-800", // modals, popovers
    subtle:  "bg-slate-800/50", // hover states, highlights
  },

  // Chart palette — Recharts / data visualization
  chart: ["#dc2626", "#f97316", "#facc15", "#4ade80", "#60a5fa", "#a855f7"],
} as const;

// ─── Severity Levels ─────────────────────────────────────────────────────────
export type SeverityLevel = "critical" | "high" | "medium" | "low";
export type StatusKey = keyof typeof COLORS.status;

export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
};

// Chart hex colors by severity — used directly in Recharts fill/stroke
export const SEVERITY_HEX: Record<SeverityLevel, string> = {
  critical: COLORS.status.critical.hex,
  high:     COLORS.status.high.hex,
  medium:   COLORS.status.medium.hex,
  low:      COLORS.status.low.hex,
};

// ─── Spacing Scale (8px grid) ────────────────────────────────────────────────
export const SPACE = {
  1:  "0.25rem",  // 4px
  2:  "0.5rem",   // 8px
  3:  "0.75rem",  // 12px
  4:  "1rem",     // 16px
  5:  "1.25rem",  // 20px
  6:  "1.5rem",   // 24px
  8:  "2rem",     // 32px
  10: "2.5rem",   // 40px
  12: "3rem",     // 48px
  16: "4rem",     // 64px
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────
export const RADIUS = {
  sm:   "rounded-md",   // 6px — inputs, small chips
  md:   "rounded-lg",   // 9px — buttons, small cards
  lg:   "rounded-xl",   // 12px — panels, sections
  xl:   "rounded-2xl",  // 16px — main cards, hero sections
  full: "rounded-full", // pills, avatars, dots
} as const;

// ─── Typography Scale ─────────────────────────────────────────────────────────
export const TYPE = {
  label:    "text-xs font-medium tracking-widest uppercase text-muted-foreground", // metadata labels
  caption:  "text-xs text-muted-foreground",                                        // secondary info
  body:     "text-sm text-foreground",                                              // main content
  bodyMd:   "text-sm font-medium text-foreground",                                  // emphasized content
  heading:  "text-base font-semibold text-foreground",                              // section headings
  title:    "text-lg font-bold text-foreground",                                    // page titles
  display:  "text-2xl font-black text-foreground",                                  // hero / stat numbers
  stat:     "text-3xl font-black tabular-nums text-foreground",                     // big metric numbers
  mono:     "font-mono text-sm tabular-nums",                                       // IDs, timestamps, code
} as const;

// ─── Shadow Scale ─────────────────────────────────────────────────────────────
export const SHADOW = {
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
} as const;

// ─── Z-Index Scale ────────────────────────────────────────────────────────────
export const Z = {
  base:    0,
  raised:  10,
  overlay: 20,
  modal:   30,
  banner:  40,
  toast:   50,
} as const;

// ─── Motion Durations (ms) ───────────────────────────────────────────────────
export const DURATION = {
  instant: 0.1,
  fast:    0.15,
  normal:  0.2,
  slow:    0.3,
  xslow:   0.5,
} as const;
