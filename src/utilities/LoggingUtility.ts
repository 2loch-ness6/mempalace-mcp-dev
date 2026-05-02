// Logging Utility — cross-cutting, domain-agnostic. May be called by any layer.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export function createLogger(scope: string, minLevel: LogLevel = 'info'): Logger {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

  function shouldLog(level: LogLevel): boolean {
    return levels.indexOf(level) >= levels.indexOf(minLevel);
  }

  function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!shouldLog(level)) return;
    const entry = {
      ts: new Date().toISOString(),
      level,
      scope,
      message,
      ...(context ? { context } : {}),
    };
    // MCP servers communicate over stdio — log to stderr to avoid polluting stdout
    process.stderr.write(JSON.stringify(entry) + '\n');
  }

  return {
    debug: (msg, ctx) => log('debug', msg, ctx),
    info: (msg, ctx) => log('info', msg, ctx),
    warn: (msg, ctx) => log('warn', msg, ctx),
    error: (msg, ctx) => log('error', msg, ctx),
  };
}
