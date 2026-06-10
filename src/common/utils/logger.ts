import { env } from '../../config/env.config';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: unknown;
  timestamp: string;
}

function formatLog(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
  if (entry.meta !== undefined) {
    const meta =
      typeof entry.meta === 'object'
        ? JSON.stringify(entry.meta, null, env.NODE_ENV === 'development' ? 2 : 0)
        : String(entry.meta);
    return `${base}\n${meta}`;
  }
  return base;
}

function createLogger() {
  const log = (level: LogLevel, message: string, meta?: unknown) => {
    const entry: LogEntry = {
      level,
      message,
      meta,
      timestamp: new Date().toISOString(),
    };
    const formatted = formatLog(entry);

    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  };

  return {
    info: (message: string, meta?: unknown) => log('info', message, meta),
    warn: (message: string, meta?: unknown) => log('warn', message, meta),
    error: (message: string, meta?: unknown) => log('error', message, meta),
    debug: (message: string, meta?: unknown) => {
      if (env.NODE_ENV === 'development') log('debug', message, meta);
    },
  };
}

export const logger = createLogger();
