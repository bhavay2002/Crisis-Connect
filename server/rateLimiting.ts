import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
});

export const reportSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "You have submitted too many reports. Please wait before submitting another.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    return req.user?.claims?.sub || "anonymous";
  },
});

export const resourceRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "You have submitted too many resource requests. Please wait before submitting another.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    return req.user?.claims?.sub || "anonymous";
  },
});

export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: "You are sending messages too quickly. Please slow down.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    return req.user?.claims?.sub || "anonymous";
  },
});

export const aiRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: "You have made too many AI requests. Please wait before trying again.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    return req.user?.claims?.sub || "anonymous";
  },
});

export const verificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50,
  message: "You are verifying reports too quickly. Please slow down.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    return req.user?.claims?.sub || "anonymous";
  },
});
