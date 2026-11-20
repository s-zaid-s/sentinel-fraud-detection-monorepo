export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestampMs: number;
  readonly context: Readonly<Record<string, unknown>>;
}

export interface ILogger {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface MetricSample {
  readonly name: string;
  readonly kind: "counter" | "histogram";
  readonly value: number;
  readonly tags: Readonly<Record<string, string>>;
}

export interface IMetricsCollector {
  increment(name: string, tags?: Record<string, string>, delta?: number): void;
  observe(name: string, value: number, tags?: Record<string, string>): void;
}

export interface TraceSpan {
  readonly name: string;
  readonly correlationId: string;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly status: "ok" | "error";
}

export interface ITracer {
  trace<T>(name: string, correlationId: string, fn: () => Promise<T>): Promise<T>;
}

export class InMemoryLogger implements ILogger {
  readonly entries: LogEntry[] = [];

  log(level: LogLevel, message: string, context: Record<string, unknown> = {}): void {
    this.entries.push({ level, message, timestampMs: Date.now(), context });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }
}

export class InMemoryMetricsCollector implements IMetricsCollector {
  readonly samples: MetricSample[] = [];

  increment(name: string, tags: Record<string, string> = {}, delta = 1): void {
    this.samples.push({ name, kind: "counter", value: delta, tags });
  }

  observe(name: string, value: number, tags: Record<string, string> = {}): void {
    this.samples.push({ name, kind: "histogram", value, tags });
  }
}

export class InMemoryTracer implements ITracer {
  readonly spans: TraceSpan[] = [];

  async trace<T>(name: string, correlationId: string, fn: () => Promise<T>): Promise<T> {
    const startedAtMs = Date.now();
    try {
      const result = await fn();
      this.spans.push({ name, correlationId, startedAtMs, endedAtMs: Date.now(), status: "ok" });
      return result;
    } catch (error) {
      this.spans.push({ name, correlationId, startedAtMs, endedAtMs: Date.now(), status: "error" });
      throw error;
    }
  }
}
