# Sentinel Fraud Detection — Architecture & Design Notes

## 1. End-to-End Event Flow

1. **Upstream Intake (`@sentinel/clients`)**: `MockUpstreamFeedClient` wraps a `TransactionRecord` in a correlation-tracked `EventEnvelope` and publishes it to `transactions.incoming`.
2. **Queue Delivery (`@sentinel/queue`)**: `InMemoryMessageQueue` buffers events, tracks metrics, executes retries on transient failures, and routes poison pills to the Dead-Letter Queue (DLQ).
3. **Gateway Orchestration (`@sentinel/gateway`)**: `FraudGateway` opens a trace span, validates the transaction, checks `decisionCache` for duplicate deliveries, persists the raw incoming transaction, resolves the channel processor via `ProcessorRegistry`, persists the resulting `ClassificationResult`, updates the cache, and triggers downstream notification.
4. **Quick-Approve Fast Path (`@sentinel/processors`)**: Before invoking ML inference, `QuickApproveEvaluator` checks cached per-`userId` rules matching `channel`, `vendorId`, `itemCategory`, `currency`, `amountMinorUnits <= maxAmountMinorUnits`, and `validFromMs <= now <= validUntilMs`.
5. **Offline ML Inference (`@sentinel/ml-engine`)**: If no quick-approve rule applies, `IFeatureExtractor` builds a structured `FeatureVector` and `IRiskModel` computes a deterministic `riskScore` (`0.0` to `1.0`), reason factors, and final `FraudDecision` (`ACCEPTED`, `NEEDS_MORE_CHECKS`, `DECLINED`).
6. **Downstream Notification (`@sentinel/clients`)**: `IDownstreamNotifierClient` records the delivered `DownstreamNotification` alongside its `correlationId` and emits delivery telemetry.

## 2. Determinism & Testability

- All time-dependent logic (cache TTLs, quick-approve windows, event timestamps) receives an `IClock` dependency. Tests inject `FixedClock` and call `advanceBy(ms)` to test expiration and sliding windows with zero flakiness or real sleeps.
- No global mutable singletons exist in production modules. `createOfflineFraudSystem()` in `services/gateway/src/bootstrap.ts` constructs an isolated instance per test.

## 3. Extending the System

To add a new transaction channel:
1. Add the channel literal and discriminated interface in `packages/domain/src/types.ts`.
2. Extend feature extraction in `packages/ml-engine`.
3. Implement `ITransactionProcessor<NewChannelTransaction>` in `services/processors`.
4. Register the new processor in `ProcessorRegistry` inside `services/gateway/src/bootstrap.ts`.
