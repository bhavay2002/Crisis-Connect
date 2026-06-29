/**
 * App-level global store barrel — single import point for all Zustand stores.
 * Feature-scoped stores live in their feature/store/ subdirectory.
 */
export {
  useAuthStore,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectUserRole,
} from "@/store/authStore";

export {
  useRealtimeStore,
  selectIsConnected,
  selectUnreadCount,
  selectLiveIncidents,
} from "@/store/realtimeStore";

export type { LiveIncident } from "@/store/realtimeStore";
