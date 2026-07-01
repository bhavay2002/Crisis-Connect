// Map feature store — thin re-export of commandCenterStore.
// Other features import from here, never from store/ directly.
export {
  useCommandCenter,
} from "@/store/commandCenterStore";

export type { CCIncident } from "@/store/commandCenterStore";
