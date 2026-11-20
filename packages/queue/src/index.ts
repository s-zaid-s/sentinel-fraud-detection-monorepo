import type { EventEnvelope } from "@sentinel/domain";
import type { ILogger, IMetricsCollector } from "@sentinel/observability";

export type MessageHandler<TPayload> = (
  envelope: EventEnvelope<TPayload>,
) => Promise<void>;

export interface DeadLetterEntry<TPayload> {
  readonly envelope: EventEnvelope<TPayload>;
  readonly reason: string;
  readonly failedAtMs: number;
}

export interface IMessageQueue<TPayload> {
  publish(envelope: EventEnvelope<TPayload>): Promise<void>;
  subscribe(handler: MessageHandler<TPayload>): void;
  drain(): Promise<number>;
  pendingCount(): number;
  deadLetters(): readonly DeadLetterEntry<TPayload>[];
}

export interface QueueOptions {
  readonly maxRetries: number;
}

export class InMemoryMessageQueue<TPayload> implements IMessageQueue<TPayload> {
  private readonly buffer: EventEnvelope<TPayload>[] = [];
  private readonly dlq: DeadLetterEntry<TPayload>[] = [];
  private readonly handlers: MessageHandler<TPayload>[] = [];
  private readonly options: QueueOptions;
  private readonly logger: ILogger;
  private readonly metrics: IMetricsCollector;

  constructor(
    logger: ILogger,
    metrics: IMetricsCollector,
    options: QueueOptions = { maxRetries: 2 },
  ) {
    this.logger = logger;
    this.metrics = metrics;
    this.options = options;
  }

  async publish(envelope: EventEnvelope<TPayload>): Promise<void> {
    this.buffer.push(envelope);
    this.metrics.increment("queue.published", { topic: envelope.topic });
    this.logger.info("Event published to queue", {
      eventId: envelope.eventId,
      topic: envelope.topic,
      correlationId: envelope.correlationId,
    });
  }

  subscribe(handler: MessageHandler<TPayload>): void {
    this.handlers.push(handler);
  }

  async drain(): Promise<number> {
    let processed = 0;
    while (this.buffer.length > 0) {
      const envelope = this.buffer.shift();
      if (!envelope) break;
      await this.dispatchWithRetry(envelope);
      processed += 1;
    }
    return processed;
  }

  pendingCount(): number {
    return this.buffer.length;
  }

  deadLetters(): readonly DeadLetterEntry<TPayload>[] {
    return this.dlq;
  }

  private async dispatchWithRetry(envelope: EventEnvelope<TPayload>): Promise<void> {
    for (const handler of this.handlers) {
      let attempt = envelope.attempt;
      while (attempt <= this.options.maxRetries) {
        try {
          await handler({ ...envelope, attempt });
          this.metrics.increment("queue.consumed", { topic: envelope.topic });
          return;
        } catch (err) {
          attempt += 1;
          this.metrics.increment("queue.retry", { topic: envelope.topic });
          if (attempt > this.options.maxRetries) {
            const reason = err instanceof Error ? err.message : String(err);
            this.dlq.push({ envelope: { ...envelope, attempt }, reason, failedAtMs: Date.now() });
            this.metrics.increment("queue.dlq", { topic: envelope.topic });
            this.logger.error("Event moved to DLQ", { eventId: envelope.eventId, reason });
          }
        }
      }
    }
  }
}
