/**
 * Structured Logger for Crewn Platform
 * Provides standardized JSON logging, log levels, operational event tracking,
 * and automatic redaction of sensitive data (passwords, tokens, secrets, card numbers).
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "audit";

export interface LogPayload {
  message: string;
  category?:
    | "AUTH"
    | "PAYMENT"
    | "WEBHOOK"
    | "STORAGE"
    | "PROJECT"
    | "COMMUNICATION"
    | "BACKGROUND_JOB"
    | "SECURITY"
    | "API";
  userId?: string | null;
  actorId?: string | null;
  ipAddress?: string | null;
  details?: Record<string, unknown> | Error | unknown;
  timestamp?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "passwordconfirmation",
  "token",
  "rawtoken",
  "tokenhash",
  "secret",
  "authsecret",
  "authorization",
  "cookie",
  "session",
  "apikey",
  "signature",
  "accountnumber",
  "accountnumberencrypted",
  "cvv",
  "cardnumber",
  "keysecret",
  "webhooksecret",
]);

/**
 * Recursively deep-redacts sensitive fields from objects before logging
 */
export function sanitizeLogData(data: unknown, depth = 0): unknown {
  if (depth > 5 || data === null || data === undefined) return data;

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: process.env.NODE_ENV !== "production" ? data.stack : undefined,
    };
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = sanitizeLogData(value, depth + 1);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return data;
}

class Logger {
  private isProduction = process.env.NODE_ENV === "production";

  private format(level: LogLevel, payload: LogPayload): string {
    const sanitizedDetails = payload.details ? sanitizeLogData(payload.details) : undefined;
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message: payload.message,
      category: payload.category || "API",
      userId: payload.userId,
      actorId: payload.actorId,
      ipAddress: payload.ipAddress,
      details: sanitizedDetails,
    };

    if (this.isProduction) {
      return JSON.stringify(entry);
    }

    const color =
      level === "error"
        ? "\x1b[31m"
        : level === "warn"
        ? "\x1b[33m"
        : level === "audit"
        ? "\x1b[35m"
        : "\x1b[36m";
    const reset = "\x1b[0m";

    return `${color}[${entry.level}] [${entry.category}]${reset} ${entry.message} ${
      sanitizedDetails ? JSON.stringify(sanitizedDetails) : ""
    }`;
  }

  debug(payload: LogPayload | string, details?: unknown) {
    if (this.isProduction) return;
    const p: LogPayload = typeof payload === "string" ? { message: payload, details } : payload;
    console.debug(this.format("debug", p));
  }

  info(payload: LogPayload | string, details?: unknown) {
    const p: LogPayload = typeof payload === "string" ? { message: payload, details } : payload;
    console.info(this.format("info", p));
  }

  warn(payload: LogPayload | string, details?: unknown) {
    const p: LogPayload = typeof payload === "string" ? { message: payload, details } : payload;
    console.warn(this.format("warn", p));
  }

  error(payload: LogPayload | string, details?: unknown) {
    const p: LogPayload = typeof payload === "string" ? { message: payload, details } : payload;
    console.error(this.format("error", p));
  }

  audit(payload: LogPayload | string, details?: unknown) {
    const p: LogPayload = typeof payload === "string" ? { message: payload, details } : payload;
    console.log(this.format("audit", p));
  }
}

export const logger = new Logger();
