type ClientLogLevel = "error" | "info" | "warn";

function writeLog(level: ClientLogLevel, event: string, details?: unknown) {
  const payload = {
    app: "signal-console-web",
    details,
    event,
    ts: new Date().toISOString(),
  };

  console[level](event, payload);
}

export const clientLogger = {
  error(event: string, details?: unknown) {
    writeLog("error", event, details);
  },
  info(event: string, details?: unknown) {
    writeLog("info", event, details);
  },
  warn(event: string, details?: unknown) {
    writeLog("warn", event, details);
  },
};
