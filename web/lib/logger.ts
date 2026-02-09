/**
 * Structured logging for critical events.
 * Avoid logging sensitive data (passwords, tokens).
 */

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const payload = JSON.stringify({
    ts: timestamp,
    level,
    event,
    ...data,
  });
  if (level === "error") {
    console.error(payload);
  } else if (level === "warn") {
    console.warn(payload);
  } else {
    console.log(payload);
  }
}

export const logger = {
  info(event: string, data?: Record<string, unknown>) {
    log("info", event, data);
  },
  warn(event: string, data?: Record<string, unknown>) {
    log("warn", event, data);
  },
  error(event: string, data?: Record<string, unknown>) {
    log("error", event, data);
  },
};
