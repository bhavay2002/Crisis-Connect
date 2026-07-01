/**
 * CrisisConnect Motion System
 * Framer Motion variant presets — consistent animation language across the app.
 *
 * Usage:
 *   import { MOTION } from "@/lib/motion";
 *   <motion.div {...MOTION.fadeUp}>...</motion.div>
 *   <motion.div variants={MOTION.staggerChild}>...</motion.div>
 *
 * Rules:
 *   - Entry:       fade + subtle upward translate (12px max)
 *   - Exit:        fade + minimal downward translate (4px)
 *   - Hover:       scale(1.02–1.05) — never more
 *   - Tap:         scale(0.96–0.98) — always slightly less than hover
 *   - Alerts:      opacity pulse — never position-based for live data
 *   - Lists:       stagger 40ms between children
 *   - Duration:    150–250ms entry, 150ms exit (exits feel snappier)
 */

import type { Variants, Transition, TargetAndTransition } from "framer-motion";

// ─── Shared Transitions ───────────────────────────────────────────────────────

const easeOut: Transition = { ease: "easeOut" };
const spring:  Transition = { type: "spring", stiffness: 380, damping: 30 };
const springBouncy: Transition = { type: "spring", stiffness: 500, damping: 25 };

// ─── Entry / Exit Animations ──────────────────────────────────────────────────

/** Simple opacity fade. Use for overlays, tooltips, banners. */
export const fadeIn = {
  initial:    { opacity: 0 },
  animate:    { opacity: 1 },
  exit:       { opacity: 0 },
  transition: { duration: 0.2, ...easeOut },
};

/** Fade + subtle upward slide. The standard card / panel entry. */
export const fadeUp = {
  initial:    { opacity: 0, y: 12 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -4 },
  transition: { duration: 0.22, ...easeOut },
};

/** Fade + scale-up. Use for modals, popovers, stat highlights. */
export const fadeScale = {
  initial:    { opacity: 0, scale: 0.95 },
  animate:    { opacity: 1, scale: 1 },
  exit:       { opacity: 0, scale: 0.97 },
  transition: { duration: 0.18, ...easeOut },
};

/** Slide in from right. Use for drawers, detail panels. */
export const slideRight = {
  initial:    { opacity: 0, x: 24 },
  animate:    { opacity: 1, x: 0 },
  exit:       { opacity: 0, x: 24 },
  transition: { duration: 0.22, ...easeOut },
};

/** Slide down from top. Use for banners, toasts dropping in. */
export const slideDown = {
  initial:    { opacity: 0, y: -12 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -12 },
  transition: { duration: 0.2, ...easeOut },
};

/** Spring pop. Use for badges, count updates, success confirmations. */
export const springPop = {
  initial:    { scale: 0.8, opacity: 0 },
  animate:    { scale: 1, opacity: 1 },
  exit:       { scale: 0.9, opacity: 0 },
  transition: springBouncy,
};

// ─── Stagger List System ──────────────────────────────────────────────────────

/**
 * Wrap a list container with staggerContainer, each child with staggerChild.
 * <motion.ul variants={MOTION.staggerContainer} initial="hidden" animate="show">
 *   {items.map(i => <motion.li variants={MOTION.staggerChild} key={i.id} />)}
 * </motion.ul>
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren:   0.05,
    },
  },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

/** For grids — stagger with a slightly longer gap. */
export const staggerGridContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

export const staggerGridChild: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show:   { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: "easeOut" } },
};

// ─── Interactive Micro-interactions ──────────────────────────────────────────

/** Standard button hover + tap. Add to interactive motion.button/div. */
export const pressable = {
  whileHover: { scale: 1.02 } as TargetAndTransition,
  whileTap:   { scale: 0.97 } as TargetAndTransition,
  transition: spring,
};

/** Card hover lift — elevation effect without shadow change. */
export const cardHover = {
  whileHover: { y: -2, scale: 1.005 } as TargetAndTransition,
  transition: { duration: 0.18, ease: "easeOut" },
};

/** Icon button — more pronounced scale. */
export const iconButton = {
  whileHover: { scale: 1.08, rotate: 5 } as TargetAndTransition,
  whileTap:   { scale: 0.92 } as TargetAndTransition,
  transition: springBouncy,
};

// ─── Real-time / Status Animations ───────────────────────────────────────────

/** Live data pulse — for "LIVE" indicators, WS-connected dots. */
export const livePulse: TargetAndTransition = {
  opacity: [1, 0.35, 1],
  transition: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
};

/** Critical alert pulse — faster, more alarming. */
export const criticalPulse: TargetAndTransition = {
  opacity: [1, 0.4, 1],
  scale:   [1, 1.08, 1],
  transition: { repeat: Infinity, duration: 1.0, ease: "easeInOut" },
};

/** Gentle beat — for "Help is on the way" confirmations. */
export const heartbeat: TargetAndTransition = {
  scale: [1, 1.12, 1, 1.06, 1],
  transition: { repeat: Infinity, duration: 2.0, ease: "easeInOut" },
};

/** Spinner — for loading states without a full skeleton. */
export const spin: TargetAndTransition = {
  rotate: 360,
  transition: { repeat: Infinity, duration: 1.2, ease: "linear" },
};

/** Count update flash — highlight a number when it changes. */
export const countFlash: TargetAndTransition = {
  backgroundColor: ["rgba(239,68,68,0)", "rgba(239,68,68,0.15)", "rgba(239,68,68,0)"],
  transition: { duration: 0.6, ease: "easeOut" },
};

// ─── Page Transitions ─────────────────────────────────────────────────────────

/** Full-page enter — use in route-level components. */
export const pageEnter = {
  initial:    { opacity: 0, y: 8 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: "easeOut" },
};

/** Tab panel switch — for tabbed views. */
export const tabPanel = {
  initial:    { opacity: 0, x: 6 },
  animate:    { opacity: 1, x: 0 },
  exit:       { opacity: 0, x: -6 },
  transition: { duration: 0.15, ease: "easeOut" },
};

// ─── Convenience MOTION namespace ─────────────────────────────────────────────
export const MOTION = {
  fadeIn,
  fadeUp,
  fadeScale,
  slideRight,
  slideDown,
  springPop,
  staggerContainer,
  staggerChild,
  staggerGridContainer,
  staggerGridChild,
  pressable,
  cardHover,
  iconButton,
  livePulse,
  criticalPulse,
  heartbeat,
  spin,
  countFlash,
  pageEnter,
  tabPanel,
} as const;
