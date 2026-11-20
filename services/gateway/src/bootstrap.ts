import {
  InMemoryDownstreamNotifierClient,
  MockUpstreamFeedClient,
} from "@sentinel/clients";
import {
  FixedClock,
  type ClassificationResult,
  type IClock,
  type QuickApproveRule,
  type TransactionRecord,
} from "@sentinel/domain";
import { DefaultFeatureExtractor, HeuristicMockRiskModel } from "@sentinel/ml-engine";
import { InMemoryLogger, InMemoryMetricsCollector, InMemoryTracer } from "@sentinel/observability";
import {
  CashWithdrawalProcessor,
  CryptoTransactionProcessor,
  InternetPaymentProcessor,
  QuickApproveEvaluator,
} from "@sentinel/processors";
import { InMemoryMessageQueue } from "@sentinel/queue";
import {
  InMemoryClassificationRepository,
  InMemoryQuickApproveStore,
  InMemoryTransactionRepository,
  InMemoryTtlCache,
} from "@sentinel/storage";
import { FraudGateway, ProcessorRegistry } from "./gateway.js";

export function createOfflineFraudSystem(clock: IClock = new FixedClock(1_760_000_000_000)) {
  const logger = new InMemoryLogger();
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();
  const queue = new InMemoryMessageQueue<TransactionRecord>(logger, metrics);

  const transactionRepo = new InMemoryTransactionRepository();
  const classificationRepo = new InMemoryClassificationRepository();
  const quickApproveStore = new InMemoryQuickApproveStore();
  const quickApproveCache = new InMemoryTtlCache<readonly QuickApproveRule[]>(clock);
  const decisionCache = new InMemoryTtlCache<ClassificationResult>(clock);

  const quickApprove = new QuickApproveEvaluator(quickApproveStore, quickApproveCache, clock);
  const featureExtractor = new DefaultFeatureExtractor();
  const riskModel = new HeuristicMockRiskModel();
  const processorDeps = { featureExtractor, riskModel, quickApprove, clock, logger };

  const registry = new ProcessorRegistry()
    .register(new InternetPaymentProcessor(processorDeps))
    .register(new CashWithdrawalProcessor(processorDeps))
    .register(new CryptoTransactionProcessor(processorDeps));

  const upstreamClient = new MockUpstreamFeedClient(queue, clock);
  const downstreamClient = new InMemoryDownstreamNotifierClient(clock, logger, metrics);

  const gateway = new FraudGateway({
    queue,
    registry,
    transactionRepo,
    classificationRepo,
    decisionCache,
    downstreamClient,
    logger,
    metrics,
    tracer,
  });
  gateway.start();

  return {
    clock,
    logger,
    metrics,
    tracer,
    queue,
    transactionRepo,
    classificationRepo,
    quickApproveStore,
    quickApproveCache,
    decisionCache,
    quickApprove,
    upstreamClient,
    downstreamClient,
    gateway,
  };
}
