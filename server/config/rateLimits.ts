export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  handler?: (req: any, res: any) => void;
}

export const rateLimitConfigs = {
  default: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many authentication attempts, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  reportSubmission: {
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Too many report submissions. Please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  resourceRequest: {
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: "Too many resource requests. Please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  verification: {
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: "Too many verification attempts. Please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  messaging: {
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: "Too many messages. Please slow down.",
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  aiRequest: {
    windowMs: 60 * 60 * 1000,
    max: 50,
    message: "Too many AI requests. Please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  fileUpload: {
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: "Too many file uploads. Please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  strictAuth: {
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: "Too many failed attempts. Account temporarily locked.",
    standardHeaders: true,
    legacyHeaders: false,
  },
} as const;

export const quotaLimits = {
  freeUser: {
    reportsPerDay: 10,
    resourceRequestsPerDay: 20,
    aidOffersPerDay: 20,
    sosAlertsPerDay: 5,
    aiRequestsPerDay: 50,
    storageQuotaMB: 100,
  },
  
  volunteer: {
    reportsPerDay: 50,
    resourceRequestsPerDay: 100,
    aidOffersPerDay: 100,
    sosAlertsPerDay: 20,
    aiRequestsPerDay: 200,
    storageQuotaMB: 500,
  },
  
  ngo: {
    reportsPerDay: 500,
    resourceRequestsPerDay: 1000,
    aidOffersPerDay: 1000,
    sosAlertsPerDay: 100,
    aiRequestsPerDay: 1000,
    storageQuotaMB: 5000,
  },
  
  admin: {
    reportsPerDay: Infinity,
    resourceRequestsPerDay: Infinity,
    aidOffersPerDay: Infinity,
    sosAlertsPerDay: Infinity,
    aiRequestsPerDay: Infinity,
    storageQuotaMB: Infinity,
  },
};

export type UserRole = keyof typeof quotaLimits;

export function getRoleQuota(role: string): typeof quotaLimits.freeUser {
  return quotaLimits[role as UserRole] || quotaLimits.freeUser;
}
