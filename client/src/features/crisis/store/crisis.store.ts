/**
 * Crisis feature store — re-exports decisionStore selectors and actions
 * through the feature boundary. Other features never import from store/ directly.
 */
export {
  useDecisionStore,
  selectEventLog,
  selectNewReportIds,
  selectActiveDecision,
} from "@/store/decisionStore";

// TimelineEvent is the canonical event type in decisionStore
export type { TimelineEvent as DecisionEvent } from "@/store/decisionStore";
