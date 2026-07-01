/**
 * Top-level features barrel.
 *
 * Import from individual features for better tree-shaking:
 *   import { useCrisisActions } from "@/features/crisis";
 *   import { RoleDashboard }    from "@/features/roles";
 *
 * This file exists for convenience and documentation only.
 */
export * as Crisis     from "./crisis";
export * as Chat       from "./chat";
export * as MapFeature from "./map";
export * as SOS        from "./sos";
export * as Analytics  from "./analytics";
export * as Roles      from "./roles";
