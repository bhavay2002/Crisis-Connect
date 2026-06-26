import jwt from "jsonwebtoken";
import type { User } from "@shared/schema";

const WEAK_SECRET_MARKER = "your-secret-key";
const WEAK_REFRESH_MARKER = "your-refresh-secret";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret-change-in-production";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

// Warn loudly at startup if weak fallback secrets are in use
if (JWT_SECRET.startsWith(WEAK_SECRET_MARKER)) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SECURITY ERROR: JWT_SECRET is not set. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
    );
  }
  console.warn(
    "⚠️  [jwtUtils] JWT_SECRET not set — using insecure development fallback. " +
    "Set JWT_SECRET env var before deploying to production."
  );
}

if (JWT_REFRESH_SECRET.startsWith(WEAK_REFRESH_MARKER)) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SECURITY ERROR: JWT_REFRESH_SECRET is not set. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
    );
  }
  console.warn(
    "⚠️  [jwtUtils] JWT_REFRESH_SECRET not set — using insecure development fallback. " +
    "Set JWT_REFRESH_SECRET env var before deploying to production."
  );
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export function generateAccessToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role || "citizen",
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function generateRefreshToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role || "citizen",
  };

  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    throw new Error("Invalid or expired access token");
  }
}

export function verifyRefreshToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
  } catch (error) {
    throw new Error("Invalid or expired refresh token");
  }
}

export function generateTokenPair(user: User) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  };
}
