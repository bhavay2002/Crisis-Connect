// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  CrisisReport, CrisisEvent, CrisisStats, ActiveDecision,
  RecommendedAction, DisasterType, ReportStatus,
} from "./types/crisis.types";

// ── Services ──────────────────────────────────────────────────────────────────
export {
  fetchReports, fetchReport, verifyReport, resolveReport,
  submitReport, fetchActiveDecisions, searchReports,
} from "./services/crisis.api";

// ── Hooks ─────────────────────────────────────────────────────────────────────
export { useCrisisRealtime }   from "./hooks/useCrisisRealtime";
export { useCrisisActions }    from "./hooks/useCrisisActions";
export { useCrisisStats, useSeverityBreakdown } from "./hooks/useCrisisStats";

// ── Store ─────────────────────────────────────────────────────────────────────
export {
  useDecisionStore, selectEventLog, selectNewReportIds, selectActiveDecision,
} from "./store/crisis.store";

// ── Components ────────────────────────────────────────────────────────────────
export { ActionPanel }       from "./components/index";
export { CriticalBadge }     from "./components/index";
export { IncidentTimeline }  from "./components/index";
export { LiveCounter }       from "./components/index";
