import crypto from "node:crypto";
import type {
  ClassificationResult,
  DownstreamNotification,
  EventEnvelope,
  IClock,
  TransactionRecord,
} from "@sentinel/domain";
import type { ILogger, IMetricsCollector } from "@sentinel/observability";
import type { IMessageQueue } from "@sentinel/queue";

export interface IUpstreamFeedClient {
  submitTransaction(tx: TransactionRecord, correlationId?: string): Promise<EventEnvelope<TransactionRecord>>;
}

export interface IDownstreamNotifierClient {
  notify(classification: ClassificationResult, correlationId: string): Promise<DownstreamNotification>;
}

export class MockUpstreamFeedClient implements IUpstreamFeedClient {
  private readonly queue: IMessageQueue<TransactionRecord>;
  private readonly clock: IClock;
  private readonly topic: string;

  constructor(
    queue: IMessageQueue<TransactionRecord>,
    clock: IClock,
    topic = "transactions.incoming",
  ) {
    this.queue = queue;
    this.clock = clock;
    this.topic = topic;
  }

  async submitTransaction(
    tx: TransactionRecord,
    correlationId = crypto.randomUUID(),
  ): Promise<EventEnvelope<TransactionRecord>> {
    const envelope: EventEnvelope<TransactionRecord> = {
      eventId: crypto.randomUUID(),
      correlationId,
      topic: this.topic,
      producedAtMs: this.clock.now(),
      attempt: 0,
      payload: tx,
    };
    await this.queue.publish(envelope);
    return envelope;
  }
}

export class InMemoryDownstreamNotifierClient implements IDownstreamNotifierClient {
  readonly delivered: DownstreamNotification[] = [];
  private readonly clock: IClock;
  private readonly logger: ILogger;
  private readonly metrics: IMetricsCollector;

  constructor(clock: IClock, logger: ILogger, metrics: IMetricsCollector) {
    this.clock = clock;
    this.logger = logger;
    this.metrics = metrics;
  }

  async notify(
    classification: ClassificationResult,
    correlationId: string,
  ): Promise<DownstreamNotification> {
    const notification: DownstreamNotification = {
      notificationId: crypto.randomUUID(),
      correlationId,
      classification,
      dispatchedAtMs: this.clock.now(),
    };
    this.delivered.push(notification);
    this.metrics.increment("downstream.notified", {
      decision: classification.decision,
      channel: classification.channel,
    });
    this.logger.info("Downstream client notified", {
      notificationId: notification.notificationId,
      transactionId: classification.transactionId,
      decision: classification.decision,
    });
    return notification;
  }
}
