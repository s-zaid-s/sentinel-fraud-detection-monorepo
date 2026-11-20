import {
  UnsupportedChannelError,
  ValidationError,
  type ClassificationResult,
  type EventEnvelope,
  type TransactionChannel,
  type TransactionRecord,
} from "@sentinel/domain";
import type { IDownstreamNotifierClient } from "@sentinel/clients";
import type { ILogger, IMetricsCollector, ITracer } from "@sentinel/observability";
import type { ITransactionProcessor } from "@sentinel/processors";
import type { IMessageQueue } from "@sentinel/queue";
import type {
  ICache,
  IClassificationRepository,
  ITransactionRepository,
} from "@sentinel/storage";

export class ProcessorRegistry {
  private readonly processors = new Map<TransactionChannel, ITransactionProcessor<TransactionRecord>>();

  register<T extends TransactionRecord>(processor: ITransactionProcessor<T>): this {
    this.processors.set(processor.channel, {
      channel: processor.channel,
      process: (tx: TransactionRecord) => processor.process(tx as T),
    });
    return this;
  }

  resolve(channel: TransactionChannel): ITransactionProcessor<TransactionRecord> {
    const processor = this.processors.get(channel);
    if (!processor) throw new UnsupportedChannelError(channel);
    return processor;
  }
}

export interface GatewayDeps {
  readonly queue: IMessageQueue<TransactionRecord>;
  readonly registry: ProcessorRegistry;
  readonly transactionRepo: ITransactionRepository;
  readonly classificationRepo: IClassificationRepository;
  readonly decisionCache: ICache<ClassificationResult>;
  readonly downstreamClient: IDownstreamNotifierClient;
  readonly logger: ILogger;
  readonly metrics: IMetricsCollector;
  readonly tracer: ITracer;
}

export class FraudGateway {
  private readonly deps: GatewayDeps;

  constructor(deps: GatewayDeps) {
    this.deps = deps;
  }

  start(): void {
    this.deps.queue.subscribe(async (envelope) => {
      await this.handleEnvelope(envelope);
    });
    this.deps.logger.info("FraudGateway subscribed to incoming transaction queue");
  }

  async handleEnvelope(envelope: EventEnvelope<TransactionRecord>): Promise<ClassificationResult> {
    const tx = envelope.payload;
    return this.deps.tracer.trace("gateway.handleTransaction", envelope.correlationId, async () => {
      if (!tx.transactionId || !tx.userId || tx.amountMinorUnits <= 0) {
        throw new ValidationError("Transaction missing required fields or non-positive amount");
      }

      const cached = this.deps.decisionCache.get(tx.transactionId);
      if (cached) {
        this.deps.metrics.increment("gateway.cache_hit", { channel: tx.channel });
        return cached;
      }

      await this.deps.transactionRepo.save(tx);
      const processor = this.deps.registry.resolve(tx.channel);
      const classification = await processor.process(tx);

      await this.deps.classificationRepo.save(classification);
      this.deps.decisionCache.set(tx.transactionId, classification, 300_000);

      this.deps.metrics.increment("gateway.classified", {
        channel: tx.channel,
        decision: classification.decision,
      });

      await this.deps.downstreamClient.notify(classification, envelope.correlationId);
      return classification;
    });
  }
}
