const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger({ level = "info", write = console.error } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const emit = (name, message) => {
    if (LEVELS[name] < threshold) return;
    write(JSON.stringify({ level: name, message }));
  };
  return {
    debug: (message) => emit("debug", message),
    info: (message) => emit("info", message),
    warn: (message) => emit("warn", message),
    error: (message) => emit("error", message),
  };
}
