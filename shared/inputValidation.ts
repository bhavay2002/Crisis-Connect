import { z } from "zod";

export function sanitizeString(input: string | null | undefined): string {
  if (!input) return "";
  
  return input
    .trim()
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .slice(0, 10000);
}

export function sanitizeHTML(input: string | null | undefined): string {
  if (!input) return "";
  
  const sanitized = input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
  
  return sanitized.slice(0, 10000);
}

export function sanitizeCoordinate(coord: string | null | undefined): string | null {
  if (!coord) return null;
  
  const cleaned = coord.trim();
  const num = parseFloat(cleaned);
  
  if (isNaN(num)) return null;
  if (num < -180 || num > 180) return null;
  
  return num.toString();
}

export function validateLatitude(lat: string | null | undefined): boolean {
  if (!lat) return false;
  const num = parseFloat(lat);
  return !isNaN(num) && num >= -90 && num <= 90;
}

export function validateLongitude(lon: string | null | undefined): boolean {
  if (!lon) return false;
  const num = parseFloat(lon);
  return !isNaN(num) && num >= -180 && num <= 180;
}

export function sanitizeMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return url.slice(0, 2000);
  } catch {
    return null;
  }
}

export function sanitizeMediaUrls(urls: string[] | null | undefined): string[] {
  if (!urls || !Array.isArray(urls)) return [];
  
  return urls
    .map(sanitizeMediaUrl)
    .filter((url): url is string => url !== null)
    .slice(0, 20);
}

export const phoneNumberSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
  .optional();

export const emailSchema = z
  .string()
  .email("Invalid email address")
  .max(255, "Email too long");

export const urlSchema = z
  .string()
  .url("Invalid URL")
  .max(2000, "URL too long");
