export type Action =
  | "incident:create"
  | "incident:read"
  | "incident:assign"
  | "incident:override"
  | "incident:merge"
  | "incident:escalate"
  | "sos:create"
  | "sos:respond"
  | "sos:dispatch"
  | "sos:close"
  | "report:create"
  | "report:verify"
  | "report:flag"
  | "report:delete"
  | "resource:create"
  | "resource:manage"
  | "aid:offer"
  | "aid:match"
  | "user:read"
  | "user:manage"
  | "user:delete"
  | "org:create"
  | "org:manage"
  | "org:view"
  | "analytics:view"
  | "analytics:export"
  | "analytics:advanced"
  | "broadcast:send"
  | "trust:view"
  | "trust:manage"
  | "ai:analyze"
  | "ai:explain"
  | "chat:send"
  | "chat:moderate"
  | "system:manage"
  | "data:export_own"
  | "data:delete_own"
  | "data:retention_manage";

export type AppRole = "citizen" | "volunteer" | "ngo" | "admin" | "government" | "authority" | "super_admin";

export const permissions: Record<Action, AppRole[]> = {
  "incident:create":        ["citizen", "volunteer", "ngo", "admin", "government", "authority", "super_admin"],
  "incident:read":          ["citizen", "volunteer", "ngo", "admin", "government", "authority", "super_admin"],
  "incident:assign":        ["admin", "authority", "super_admin"],
  "incident:override":      ["admin", "authority", "super_admin"],
  "incident:merge":         ["admin", "authority", "super_admin"],
  "incident:escalate":      ["admin", "authority", "super_admin"],

  "sos:create":             ["citizen", "volunteer", "ngo", "admin", "government", "authority", "super_admin"],
  "sos:respond":            ["volunteer", "ngo", "admin", "authority", "super_admin"],
  "sos:dispatch":           ["admin", "authority", "super_admin"],
  "sos:close":              ["admin", "authority", "super_admin"],

  "report:create":          ["citizen", "volunteer", "ngo", "admin", "government", "authority", "super_admin"],
  "report:verify":          ["volunteer", "ngo", "admin", "authority", "super_admin"],
  "report:flag":            ["admin", "authority", "super_admin"],
  "report:delete":          ["admin", "super_admin"],

  "resource:create":        ["citizen", "volunteer", "ngo", "admin", "authority", "super_admin"],
  "resource:manage":        ["ngo", "admin", "authority", "super_admin"],

  "aid:offer":              ["volunteer", "ngo", "admin", "authority", "super_admin"],
  "aid:match":              ["ngo", "admin", "authority", "super_admin"],

  "user:read":              ["admin", "authority", "super_admin"],
  "user:manage":            ["admin", "super_admin"],
  "user:delete":            ["super_admin"],

  "org:create":             ["ngo", "admin", "government", "authority", "super_admin"],
  "org:manage":             ["admin", "super_admin"],
  "org:view":               ["ngo", "admin", "government", "authority", "super_admin"],

  "analytics:view":         ["admin", "government", "authority", "super_admin"],
  "analytics:export":       ["admin", "government", "authority", "super_admin"],
  "analytics:advanced":     ["admin", "authority", "super_admin"],

  "broadcast:send":         ["ngo", "admin", "government", "authority", "super_admin"],

  "trust:view":             ["admin", "authority", "super_admin"],
  "trust:manage":           ["admin", "super_admin"],

  "ai:analyze":             ["citizen", "volunteer", "ngo", "admin", "government", "authority", "super_admin"],
  "ai:explain":             ["admin", "government", "authority", "super_admin"],

  "chat:send":              ["citizen", "volunteer", "ngo", "admin", "government", "authority", "super_admin"],
  "chat:moderate":          ["admin", "authority", "super_admin"],

  "system:manage":          ["super_admin"],

  "data:export_own":        ["citizen", "volunteer", "ngo", "admin", "government", "authority", "super_admin"],
  "data:delete_own":        ["citizen", "volunteer", "ngo", "admin", "government", "authority", "super_admin"],
  "data:retention_manage":  ["admin", "super_admin"],
};

export function can(role: string, action: Action): boolean {
  const allowed = permissions[action];
  if (!allowed) return false;
  return allowed.includes(role as AppRole);
}
