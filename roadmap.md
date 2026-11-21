# Sentinel Fraud Detection — Engineering Roadmap (48 Tickets)

> **Target Architecture:** Offline-only, event-driven TypeScript monorepo implementing SOLID principles, decoupled packages, simulated ML classification, per-user quick-approve caching, upstream/downstream clients, observability, and full unit + E2E test suites.
>
> **Ticket Sizing:** Each ticket is scoped for **~3–4 hours of focused work by an AI programmer** (design, strict TypeScript implementation, DI wiring, edge-case hardening, deterministic offline tests, and documentation updates).
>
> **Total Tickets:** 48 (8 Epics × 6 Tickets)

---

## Epic 1: Monorepo Foundations, Domain Modelling & Contracts (`FD-001` – `FD-006`)

### Ticket FD-001

1. **Title:** Strict Workspace Tooling, Project References & Hardened Offline Network Guardrails
2. **Description:**
   Harden the monorepo build and test foundation so every package compiles cleanly via TypeScript project references (`tsc -b`), enforces strict erasable TypeScript with zero `any`, and guarantees at runtime that no test or module can ever perform outbound network I/O (`fetch`, `node:http`, `node:https`, `node:net`, `node:tls`, `node:dns`, `WebSocket`). Add workspace-wide lint/format configuration and package boundary checks so lower-level packages (like `@sentinel/domain`) cannot accidentally import higher-level services.
3. **Acceptance Criteria:**
   - `tsconfig.base.json` and all workspace `tsconfig.json` files build cleanly with `pnpm build` and `pnpm typecheck` with zero warnings or errors.
   - `tests/offline-guard.setup.ts` intercepts and throws an `OfflineNetworkViolationError` on any call to `globalThis.fetch`, `globalThis.WebSocket`, `http.request`, `https.request`, `net.connect`, `tls.connect`, and `dns.lookup`.
   - A workspace dependency boundary test verifies the acyclic DAG (`domain` -> zero internal deps; `observability` -> zero internal deps; `services/*` never imported by `packages/*`).
   - Root `package.json` includes working scripts for `build`, `typecheck`, `test`, `test:unit`, `test:e2e`, and `verify:offline`.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Alright mate, listen up — before we start slapping features into this repo, we need the foundations locked down proper tight. Go through every `tsconfig.json` and `package.json` in the monorepo and make sure TypeScript project references build dead clean with zero `any` nonsense. More importantly, upgrade `tests/offline-guard.setup.ts` so it doesn't just block `fetch` — lock off `http`, `https`, `net`, `tls`, `dns`, and `WebSocket` as well. If anything even tries to sniff the internet, it needs to blow up instantly with a clear `OfflineNetworkViolationError`. Chuck in a workspace boundary test too so nobody accidentally imports `@sentinel/gateway` inside `@sentinel/domain` — that'd be bare peak. Keep it tidy, zero extra runtime deps, safe.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm typecheck && pnpm build`
   - `pnpm vitest run tests/unit/offline-guard.test.ts` (asserts all blocked network APIs throw synchronously/asynchronously)
   - `pnpm vitest run tests/unit/workspace-boundaries.test.ts` (asserts package dependency DAG has zero violations)

---

### Ticket FD-002

1. **Title:** Immutable Money, Currency & Safe Minor-Unit Arithmetic Value Objects
2. **Description:**
   Replace raw numeric currency handling with a dedicated immutable `Money` value object and ISO-4217 / crypto asset registry inside `@sentinel/domain`. Support minor-unit safe integer arithmetic (`add`, `subtract`, `multiply`, `compareTo`, `isWithinRange`), currency mismatch guards, zero/negative checks, and deterministic offline FX normalisation rates so cross-currency thresholds and quick-approve caps can be evaluated accurately without floating-point drift.
3. **Acceptance Criteria:**
   - `Money` class enforces safe integer minor units (throws `ValidationError` on `NaN`, `Infinity`, floats, or unsupported currency codes).
   - Supports fiat currencies (`GBP`, `USD`, `EUR`, `JPY` with accurate decimal exponents) and crypto assets (`BTC`, `ETH`, `USDC`, `USDT`) with explicit precision scaling.
   - Includes an `IOfflineFxConverter` interface and `StaticOfflineFxConverter` implementation with deterministic lookup tables and inverse-rate calculation.
   - All existing domain types and processors adopt or interoperate cleanly with `Money` helpers without breaking existing tests.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Yo bruv, floating point maths in a fraud engine is asking for trouble, init. Head into `packages/domain` and build a proper immutable `Money` value object that works strictly in minor units with safe integer checks — none of that `0.1 + 0.2 = 0.30000000000000004` madness. Make sure it knows the decimal precision for major fiat currencies like GBP, USD, EUR, JPY plus crypto tickers like BTC, ETH, and USDC. Also wire up an `IOfflineFxConverter` interface with a clean static offline implementation so we can normalise amounts to GBP when checking thresholds without touching an external API. Write solid unit tests covering currency mismatches, overflow boundaries, and rounding. Dead tidy, yeah?
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/domain/money.test.ts`
   - `pnpm vitest run tests/unit/domain/fx-converter.test.ts`
   - `pnpm typecheck`

---

### Ticket FD-003

1. **Title:** Exhaustive Transaction Channel Schemas & Runtime Validation Guards
2. **Description:**
   Implement pure TypeScript, zero-dependency runtime schema validators and type guards in `@sentinel/domain` for all three transaction channels (`INTERNET_PAYMENT`, `CASH_WITHDRAWAL`, `CRYPTO`). Validate field formats (IPv4/IPv6 syntax, ISO country codes, wallet address formats per chain, timestamp skew bounds, positive amounts, non-empty IDs) and return structured field-level validation issues rather than generic strings.
3. **Acceptance Criteria:**
   - Dedicated validators: `validateInternetPayment`, `validateCashWithdrawal`, `validateCryptoTransaction`, and unified `validateTransactionRecord`.
   - Returns a discriminated `ValidationResult<TransactionRecord>` containing either `{ ok: true, value }` or `{ ok: false, issues: ValidationIssue[] }` with `path`, `code`, and `message`.
   - Validates channel-specific invariants (e.g., EVM hex wallet format vs BTC address format, valid ISO-3166 alpha-2 country codes for ATM withdrawals, IP format for internet payments).
   - `FraudGateway` uses `validateTransactionRecord` before persisting or routing incoming messages.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Safe, so right now the gateway only checks like three fields and calls it a day — that's way too loose, mate. In `packages/domain`, build proper zero-dependency runtime validators and TypeScript type guards for all three channels: `INTERNET_PAYMENT`, `CASH_WITHDRAWAL`, and `CRYPTO`. Check everything properly — IP formats, ISO country codes, wallet address shapes for Ethereum/Bitcoin, positive minor-unit amounts, timestamp sanity, the lot. Return a structured result with exact field paths and error codes instead of throwing vague one-liners. Hook it straight into `FraudGateway` so dodgy payloads get binned early and cleanly.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/domain/transaction-validation.test.ts`
   - `pnpm vitest run tests/unit/gateway.unit.test.ts`

---

### Ticket FD-004

1. **Title:** Versioned Event Envelope, Correlation Propagation & Schema Registry
2. **Description:**
   Elevate `EventEnvelope<T>` in `@sentinel/domain` to an enterprise event-driven contract supporting `schemaVersion`, `eventType`, `causationId`, `correlationId`, `partitionKey`, `idempotencyKey`, and typed headers. Add an offline `EventSchemaRegistry` that validates envelope versions and supports upcasting legacy event schemas (e.g., `v1` -> `v2`) transparently before consumers process them.
3. **Acceptance Criteria:**
   - `EventEnvelope<T>` includes `schemaVersion`, `eventType`, `causationId`, `correlationId`, `partitionKey`, and `headers`.
   - `EventSchemaRegistry` supports registering schema validators and chained upcasters (`v1 -> v2`).
   - Unknown or incompatible major schema versions fail fast with a typed `SchemaVersionError`.
   - `MockUpstreamFeedClient` and `FraudGateway` populate and preserve `correlationId` and `causationId` across the full lifecycle.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Listen, if we're mimicking a proper event-driven system, our `EventEnvelope` needs to look the part, not some barebones toy object. Upgrade it in `@sentinel/domain` to carry `schemaVersion`, `eventType`, `causationId`, `correlationId`, `partitionKey`, and typed `headers`. Then build an offline `EventSchemaRegistry` with upcaster support so if a `v1` transaction event lands on the queue, it automatically upgrades to `v2` before the gateway even sees it. Make sure `correlationId` and `causationId` flow all the way from upstream intake right out to the downstream notification. No shortcuts, bruv.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/domain/event-schema-registry.test.ts`
   - `pnpm test:e2e`

---

### Ticket FD-005

1. **Title:** Typed Domain Error Hierarchy, Result Monad & Retryability Classification
2. **Description:**
   Establish a comprehensive, SOLID error handling architecture across `@sentinel/domain` with explicit separation between **retryable transient faults** (e.g., cache timeout, simulated datastore lock, downstream 503) and **non-retryable permanent faults** (e.g., validation failure, unsupported channel, malformed schema). Introduce a lightweight, idiomatic `Result<T, E>` utility (`ok`, `err`, `map`, `flatMap`, `unwrapOr`) so hot paths can avoid exception-driven control flow where appropriate.
3. **Acceptance Criteria:**
   - Base `SentinelError` class carries `code`, `retryable: boolean`, `category` (`DOMAIN` | `INFRA` | `SECURITY` | `VALIDATION`), `metadata`, and optional `cause`.
   - Concrete subclasses cover `ValidationError`, `UnsupportedChannelError`, `TransientInfrastructureError`, `ConcurrencyConflictError`, `DownstreamDeliveryError`, and `OfflineViolationError`.
   - `InMemoryMessageQueue` inspects `retryable`: permanent errors bypass retries and move straight to DLQ; transient errors retry up to `maxRetries`.
   - `Result<T, E>` helpers are 100% strictly typed and exported from `@sentinel/domain`.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Right mate, right now if a message fails validation, the queue retries it twice like a muppet even though retrying bad data will never magically fix it. Let's sort that out properly. Build a clean `SentinelError` hierarchy in `@sentinel/domain` that explicitly flags whether an error is `retryable` or permanent, plus a clean `Result<T, E>` helper so our core logic isn't throwing exceptions for expected failures. Update `InMemoryMessageQueue` so non-retryable errors skip the retry loop and go straight to the DLQ while transient faults still get retried. Prove both paths with sharp unit tests.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/domain/result-and-errors.test.ts`
   - `pnpm vitest run tests/unit/queue/retry-classification.test.ts`

---

### Ticket FD-006

1. **Title:** Deterministic Clock, Seeded PRNG & Time-Travel Test Harness
2. **Description:**
   Build a deterministic simulation toolkit inside `@sentinel/domain` (and shared test helpers) comprising an upgraded `ControllableClock` (supporting scheduled timers, `advanceBy`, `setNow`, and drift simulation), a seeded Mulberry32/Xoshiro PRNG (`ISeededRandom`) for reproducible offline traffic and ML/chaos testing, and a deterministic UUID generator (`IIdGenerator`) injected across clients, queues, and stores.
3. **Acceptance Criteria:**
   - No production code directly calls `Date.now()`, `Math.random()`, or `crypto.randomUUID()` without going through injected `IClock` / `IIdGenerator` / `ISeededRandom` (with sensible defaults in bootstrap).
   - Running the same simulation twice with the same seed and initial clock timestamp yields byte-for-byte identical transaction IDs, notification IDs, logs, and risk scores.
   - `ControllableClock` supports registering virtual timers/callbacks that fire strictly in chronological order during `advanceBy(ms)`.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Bruv, flaky tests are an absolute nightmare and we're not having any of that in this repo. Sweep through the packages and kill off every direct call to `Date.now()`, `Math.random()`, and `crypto.randomUUID()` by introducing proper injected `IClock`, `IIdGenerator`, and a seeded `ISeededRandom` (like Mulberry32) in `@sentinel/domain`. Upgrade `FixedClock` into a proper `ControllableClock` that can even fire virtual scheduled callbacks in exact order when we call `advanceBy`. The goal is dead simple: same seed + same start time = identical outputs down to the last character, every single run.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/domain/determinism.test.ts`
   - `pnpm test`

---

## Epic 2: Event-Driven Queue & Messaging Infrastructure (`FD-007` – `FD-012`)

### Ticket FD-007

1. **Title:** Partitioned In-Memory Message Broker with Per-`userId` Ordering Guarantees
2. **Description:**
   Upgrade `@sentinel/queue` from a single flat array into a multi-topic, multi-partition in-memory broker mimicking Kafka/Pulsar semantics. Messages are hashed deterministically by `partitionKey` (defaulting to `tx.userId`) so all transactions for a single user are strictly processed in FIFO order within their partition, while independent users across different partitions can be processed concurrently.
3. **Acceptance Criteria:**
   - Supports multiple named topics (`transactions.incoming`, `transactions.classified`, `transactions.dlq`, `cache.invalidations`) with configurable partition counts.
   - Deterministic partition router (`IPartitionStrategy`) maps identical `partitionKey` values to the same partition index.
   - Per-partition offset tracking (`committedOffset`, `latestOffset`, `lag`) is exposed via broker inspection methods.
   - Concurrent draining across partitions guarantees strict in-order execution for every single `userId`.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Alright mate, a flat array queue was fine for the skeleton, but for a real fraud engine we need per-user ordering — imagine two transactions for the same user overtaking each other, total carnage. Upgrade `@sentinel/queue` into a multi-topic, partitioned broker with a clean `IPartitionStrategy` hashing on `partitionKey` (which defaults to `userId`). Track partition offsets and consumer lag properly, and make sure different partitions can run concurrently while messages for the same user stay strictly FIFO. Write tests firing interleaved bursts across multiple users to prove ordering never breaks.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/queue/partitioned-broker.test.ts`
   - `pnpm test:e2e`

---

### Ticket FD-008

1. **Title:** Consumer Groups, Visibility Timeouts, Explicit Ack/Nack & Lease Renewal
2. **Description:**
   Implement explicit message acknowledgement lifecycles (`ack`, `nack`, `extendLease`) and consumer groups inside `@sentinel/queue`. When a consumer leases a message, it becomes invisible to other consumers in the same group until either acknowledged or its visibility timeout expires (checked via `IClock`), at which point it becomes redeliverable with an incremented delivery attempt count.
3. **Acceptance Criteria:**
   - `DeliveryContext<T>` passed to handlers exposes `envelope`, `ack()`, `nack(reason, requeue?)`, and `extendVisibility(extraMs)`.
   - Unacknowledged messages automatically return to the ready state once `IClock` advances past their visibility timeout.
   - Multiple consumer groups subscribed to the same topic each receive an independent copy of every message; consumers within the same group share partition load.
   - Auto-ack wrapper remains available for simple consumers while `FraudGateway` uses explicit `ack`/`nack`.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Safe bruv, let's level up the queue delivery semantics. Real message brokers don't just pop a message and pray — they lease it out with a visibility timeout. Add consumer groups and a `DeliveryContext` to `@sentinel/queue` with explicit `ack()`, `nack()`, and `extendVisibility()` methods driven by our `IClock`. If a worker crashes or ghosts a message without acking, advancing the clock past the visibility timeout must put it straight back up for redelivery with an incremented attempt count. Also make sure two different consumer groups on the same topic both get the events independently. Sort out thorough tests using `ControllableClock`.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/queue/consumer-groups-ack.test.ts`
   - `pnpm vitest run tests/unit/gateway.unit.test.ts`

---

### Ticket FD-009

1. **Title:** Exponential Backoff Retry Scheduler & Dead-Letter Queue (DLQ) Pipeline
2. **Description:**
   Replace the synchronous retry while-loop in `@sentinel/queue` with an event-driven delayed retry queue using exponential backoff with bounded deterministic jitter (via `ISeededRandom`) and `IClock`-scheduled redelivery. Enhance the Dead-Letter Queue so failed envelopes include full failure history (every attempt's timestamp, error code, and stack trace) and support replay (`requeueFromDlq`) back to the source topic.
3. **Acceptance Criteria:**
   - `RetryPolicy` interface configures `maxRetries`, `baseDelayMs`, `maxDelayMs`, `multiplier`, and deterministic jitter factor.
   - Retries do not block healthy messages in the same partition/topic when scheduled onto a delay queue.
   - Each DLQ record preserves `attempts: AttemptFailureRecord[]`, `originalTopic`, `finalErrorCode`, and `deadLetteredAtMs`.
   - `requeueFromDlq(eventId)` resets retry counters, attaches a `replayedFromDlq: "true"` header, and republishes cleanly.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Yo, that tight `while` loop retry in `InMemoryMessageQueue` is a bit rookie, mate — in real life you'd block the whole queue if one message starts flapping. Rip that out and build a proper delayed retry scheduler with exponential backoff and deterministic seeded jitter tied to `IClock`. When a message runs out of retries, stick it in the DLQ with a full timeline of every failed attempt, error code, and reason. Chuck in a `requeueFromDlq` method too so ops can replay poison pills once a bug's fixed. Test the backoff delays, non-blocking behaviour, and DLQ replay end-to-end.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/queue/retry-scheduler-dlq.test.ts`

---

### Ticket FD-010

1. **Title:** Idempotent Consumer Middleware & Deduplication Store
2. **Description:**
   Guarantee at-least-once delivery safety by implementing a reusable `IdempotentConsumerMiddleware` in `@sentinel/queue` backed by an `IIdempotencyStore` in `@sentinel/storage`. Detect duplicate `eventId` / `idempotencyKey` deliveries (including in-flight duplicates and post-commit replays within a configurable TTL window) so transactions are never double-charged, double-scored, or double-notified.
3. **Acceptance Criteria:**
   - `IIdempotencyStore` tracks states `IN_PROGRESS`, `COMPLETED` (with cached outcome metadata), and `FAILED` (allowing retry).
   - Duplicate events with a `COMPLETED` key are acked immediately, logged as duplicates, increment `queue.duplicate_skipped`, and never invoke downstream side effects twice.
   - Expired idempotency keys are purged via `IClock` without leaking memory.
   - Middleware composes cleanly with `FraudGateway` without polluting domain processor logic.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Listen, in any event-driven backend you're guaranteed duplicate deliveries sooner or later — it's peak if we send two notifications or double-store the same transaction. Build an `IIdempotencyStore` in `@sentinel/storage` and an `IdempotentConsumerMiddleware` in `@sentinel/queue` that tracks `IN_PROGRESS`, `COMPLETED`, and `FAILED` keys with TTL cleanup. If a duplicate `eventId` or `idempotencyKey` lands after it's already completed, ack it cleanly, bump a duplicate metric, and don't touch the processor or downstream client again. If the first attempt failed, make sure the retry is still allowed through. Proper clean SOLID middleware pattern, init.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/queue/idempotency-middleware.test.ts`
   - `pnpm vitest run tests/e2e/fraud-pipeline.e2e.test.ts`

---

### Ticket FD-011

1. **Title:** Backpressure Control, Concurrency Limiter & Graceful Shutdown Drain
2. **Description:**
   Add queue capacity limits (high/low watermarks), configurable consumer concurrency (`maxInFlight`), and a graceful `stop()` / `shutdown(timeoutMs)` lifecycle to `@sentinel/queue` and `@sentinel/gateway`. When the queue reaches its high watermark, publishers receive structured backpressure signals (or `QueueFullError` depending on overflow policy), and during shutdown the gateway stops accepting new leases while draining all in-flight transactions cleanly.
3. **Acceptance Criteria:**
   - Queue supports `maxQueueDepth` and overflow strategies (`REJECT`, `BLOCK_UNTIL_DRAINED`, `DROP_OLDEST_LOW_PRIORITY`).
   - Consumer concurrency never exceeds `maxInFlight` even under bursts of 1,000+ queued transactions.
   - `gateway.shutdown(timeoutMs)` stops leasing new messages, awaits in-flight classifications, flushes metrics/logs, and resolves cleanly (or returns a timeout report if a handler hangs).
   - Emits `queue.depth` gauge and `queue.backpressure_triggered` counter metrics.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Alright bruv, if upstream starts blasting 5,000 transactions a second and we've got no backpressure, the whole service is gonna fall over. Add high/low watermark backpressure, configurable overflow policies (`REJECT` or wait), and a strict `maxInFlight` concurrency limiter to `@sentinel/queue`. Then add a proper graceful `shutdown()` lifecycle to `FraudGateway` so when we tell it to stop, it refuses fresh messages, finishes whatever's already in flight, and shuts down clean without dropping a single classification. Write deterministic async tests proving `maxInFlight` is never breached and shutdown waits for active jobs.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/queue/backpressure-and-shutdown.test.ts`

---

### Ticket FD-012

1. **Title:** Transactional Outbox Pattern & Replayable Event Log
2. **Description:**
   Eliminate dual-write inconsistencies between datastore persistence and downstream event emission by implementing an offline Transactional Outbox (`IOutboxStore`, `OutboxRelayWorker`) plus an append-only `EventLog` supporting point-in-time replay. When `FraudGateway` classifies a transaction, it writes both the classification and an outbox event atomically; `OutboxRelayWorker` then dispatches pending outbox entries to the downstream topic/client and marks them published.
3. **Acceptance Criteria:**
   - `InMemoryOutboxStore` stores pending outbox records (`id`, `aggregateId`, `eventType`, `payload`, `status`, `createdAtMs`, `publishedAtMs`).
   - `OutboxRelayWorker` polls pending records in batches, publishes them idempotently, and handles relay failures without losing records.
   - `EventLog` supports `append`, `readFromOffset(offset, limit)`, and `replayTo(handler, fromOffset)` for deterministic state reconstruction.
   - Proven by a fault-injection test where downstream delivery fails on first relay pass and succeeds on second pass with zero lost classifications.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Right mate, right now if the gateway saves a classification to storage and then the downstream notifier crashes, we've got a classic dual-write split-brain — long day. Implement a proper Transactional Outbox pattern (`IOutboxStore` in `@sentinel/storage` and `OutboxRelayWorker` in `@sentinel/queue`) plus an append-only `EventLog` with offset-based replay. Wire the gateway so classifications and outbox records commit together, and let the relay worker push them downstream reliably. Prove with a fault-injection test that even if downstream blows up twice, the outbox retries and eventually delivers every single notification without losing data.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/queue/outbox-and-event-log.test.ts`

---

## Epic 3: Observability, Structured Logging, Metrics & Tracing (`FD-013` – `FD-018`)

### Ticket FD-013

1. **Title:** Structured JSON Logger with PII Redaction & AsyncLocalStorage Context Propagation
2. **Description:**
   Upgrade `@sentinel/observability` with a production-grade structured logger featuring Node `AsyncLocalStorage` correlation context propagation (`withCorrelationContext`), configurable minimum log levels, child loggers with bound metadata, and an automatic PII/sensitive-field redaction pipeline (masking IP addresses, full wallet hashes, card tokens, or sensitive keys like `pin`, `secret`, `token`, `cardNumber`).
3. **Acceptance Criteria:**
   - `CorrelationContext` automatically attaches `correlationId`, `traceId`, and `transactionId` to every log entry inside an async execution tree without passing them through every helper signature.
   - `PiiRedactor` recursively sanitises nested objects and arrays (masking keys matching configurable patterns and partially masking IPs/wallets).
   - Supports pluggable `ILogSink` implementations (`InMemoryLogSink`, `JsonLineBufferSink`) so logs remain 100% offline and inspectable.
   - Log filtering respects runtime log levels (`debug` < `info` < `warn` < `error`).
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Safe mate, logging raw IPs or sensitive tokens in a fintech backend will get compliance kicking down your door immediately. Upgrade `@sentinel/observability` with a proper structured JSON logger backed by Node's `AsyncLocalStorage` so `correlationId`, `traceId`, and `transactionId` propagate automatically through every async call without us passing them into ten function arguments. Build a recursive `PiiRedactor` that scrubs sensitive keys and masks IP addresses/wallet strings cleanly, plus pluggable `ILogSink`s (`InMemoryLogSink` and `JsonLineBufferSink`). Keep it 100% offline and test deep nested redaction and async context isolation thoroughly.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/observability/structured-logger-pii.test.ts`

---

### Ticket FD-014

1. **Title:** High-Resolution Metrics Collector (Counters, Gauges, Histograms & Percentiles)
2. **Description:**
   Expand `IMetricsCollector` in `@sentinel/observability` to support counters, gauges, and bucketed histograms with exact quantile/percentile reporting (`p50`, `p90`, `p95`, `p99`, `min`, `max`, `mean`) and tag cardinality guards. Instrument queue depth, classification latency per channel, decision breakdown, quick-approve hit rate, and cache hit/miss ratios.
3. **Acceptance Criteria:**
   - Supports `increment(name, tags, delta)`, `gauge(name, value, tags)`, `observe(name, value, tags)`, and `startTimer(name, tags)` using `IClock` or high-res timing.
   - `snapshot()` returns structured aggregated metrics including counter totals, latest gauge values, and histogram summaries (`count`, `sum`, `p50`, `p95`, `p99`).
   - Enforces a configurable tag-cardinality cap to prevent high-cardinality tags (like raw `transactionId` or `userId`) from causing unbounded memory growth.
   - Integrated into `FraudGateway`, `InMemoryMessageQueue`, and `QuickApproveEvaluator`.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Yo bruv, pushing raw metric samples into an infinite array is gonna eat RAM for breakfast under load. Upgrade `InMemoryMetricsCollector` in `@sentinel/observability` into a proper aggregator supporting counters, gauges, and histograms that calculate `p50`, `p95`, and `p99` cleanly in `snapshot()`. Add a tag-cardinality guardrail too so if someone mistakenly sticks a `userId` or `transactionId` in metric tags, it flags/caps it instead of exploding memory. Wire gauges and latency timers across the gateway, queue, and quick-approve cache, and prove the percentile maths with tight unit tests.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/observability/metrics-collector.test.ts`

---

### Ticket FD-015

1. **Title:** Distributed Tracing Span Engine with Parent-Child Trees & Latency Breakdown
2. **Description:**
   Transform `InMemoryTracer` into a hierarchical OpenTelemetry-inspired offline tracing engine supporting `traceId`, `spanId`, `parentSpanId`, span attributes, span events, and error recording. Wire nested spans across the full transaction lifecycle (`upstream.publish` -> `queue.consume` -> `gateway.handle` -> `quick_approve.evaluate` -> `ml.score` -> `storage.save` -> `downstream.notify`) and provide a trace tree inspector for debugging and E2E assertions.
3. **Acceptance Criteria:**
   - Nested `tracer.trace(...)` calls automatically resolve `parentSpanId` via `AsyncLocalStorage` and share the root `traceId`.
   - Spans support `setAttribute(k, v)`, `addEvent(name, attrs)`, and capture exception type/message on failure.
   - `getTraceTree(traceId)` reconstructs a nested span tree with self-time and total-time calculations.
   - E2E pipeline tests assert the full parent-child span hierarchy for both quick-approved and ML-scored transactions.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Alright mate, flat spans don't tell you where time is actually going when a transaction gets slow. Upgrade `@sentinel/observability`'s tracer into a proper hierarchical span engine with `traceId`, `spanId`, `parentSpanId` wired via `AsyncLocalStorage`, plus span attributes and timeline events. Instrument every hop from upstream intake through queue, gateway, quick-approve, ML scoring, storage, and downstream notify. Add a `getTraceTree(traceId)` helper that spits out the parent-child tree and duration breakdown. Prove in unit and E2E tests that every span links back to its parent cleanly.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/observability/distributed-tracer.test.ts`
   - `pnpm test:e2e`

---

### Ticket FD-016

1. **Title:** Immutable Compliance Audit Trail & Tamper-Evident Hash Chain Ledger
2. **Description:**
   In regulated financial fraud systems, every decision (`ACCEPTED`, `NEEDS_MORE_CHECKS`, `DECLINED`), quick-approve rule change, and manual/system override must be durably auditable. Build an `IAuditTrail` port and `HashChainedAuditLedger` implementation in `@sentinel/observability` where each audit entry links via SHA-256 hash to the previous entry, allowing offline tamper verification.
3. **Acceptance Criteria:**
   - Records structured audit events for `TRANSACTION_RECEIVED`, `CLASSIFICATION_DECIDED`, `QUICK_APPROVE_RULE_UPSERTED`, `QUICK_APPROVE_RULE_REVOKED`, and `DOWNSTREAM_NOTIFIED`.
   - Each entry computes `entryHash = sha256(previousHash + canonicalJson(entry))` using Node's built-in `node:crypto`.
   - `verifyIntegrity()` scans the ledger and returns `{ valid: true }` or identifies the exact tampered index.
   - Supports querying audit history by `userId`, `transactionId`, or `correlationId`.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Listen bruv, regulators don't mess about — if we decline a customer's payment or fast-track it with quick-approve, we need an airtight audit trail proving why and when it happened. Build an `IAuditTrail` interface and a `HashChainedAuditLedger` in `@sentinel/observability` using `node:crypto` SHA-256 so every record chains onto the previous hash. Add a `verifyIntegrity()` check that catches any mutation instantly, plus query methods by `userId`, `transactionId`, and `correlationId`. Wire it into the gateway and quick-approve flows, and write tests proving both valid chains and tampered-entry detection.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/observability/audit-ledger.test.ts`

---

### Ticket FD-017

1. **Title:** Health Checks, Readiness Probes & Queue Lag / Error-Rate Anomaly Monitor
2. **Description:**
   Build a monitoring subsystem in `@sentinel/observability` providing pluggable `IHealthCheck` probes (`queue`, `storage`, `mlEngine`, `downstreamClient`), an aggregated `HealthMonitor` returning `HEALTHY` | `DEGRADED` | `UNHEALTHY` status reports, and an offline `AlertEvaluator` that fires typed operational alerts when queue lag, DLQ count, decline rate spike, or P99 latency breach configurable thresholds.
3. **Acceptance Criteria:**
   - `HealthMonitor.checkAll()` executes all registered `IHealthCheck` probes concurrently with per-probe timeout protection and produces a structured report.
   - `AlertEvaluator` supports rule-based thresholds (e.g., `dlq_count > 5`, `decline_ratio > 0.40`, `p99_latency_ms > 200`, `queue_lag > 500`) with cooldown suppression via `IClock`.
   - Alerts emit structured events to an `IAlertSink` (`InMemoryAlertSink`) without any external HTTP calls.
   - Demonstrated in tests simulating a spike in declined crypto transactions and DLQ growth.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Safe, so logs and metrics are sweet, but a proper production service knows when it's having a mare before users complain. Build a `HealthMonitor` with pluggable `IHealthCheck` probes for the queue, stores, ML engine, and downstream notifier, returning `HEALTHY`, `DEGRADED`, or `UNHEALTHY`. On top of that, add an offline `AlertEvaluator` that checks metrics snapshots against threshold rules — like DLQ spikes, queue lag blowing up, or decline rates shooting way past normal — with cooldown suppression powered by `IClock` so it doesn't spam alerts. Keep it 100% offline and test every alert trigger and cooldown window.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/observability/health-and-alerts.test.ts`

---

### Ticket FD-018

1. **Title:** Offline Telemetry Exporter & Diagnostic Run Report Generator
2. **Description:**
   Create a zero-network telemetry exporter in `@sentinel/observability` that compiles logs, aggregated metrics, trace trees, audit integrity results, and active alerts into a self-contained JSON and human-readable Markdown diagnostic report. This gives engineers complete visibility into any offline test run or simulation batch.
3. **Acceptance Criteria:**
   - `TelemetryReportBuilder` aggregates data from `InMemoryLogger`, `InMemoryMetricsCollector`, `InMemoryTracer`, `HashChainedAuditLedger`, and `InMemoryAlertSink`.
   - Supports exporting to both structured JSON (`DiagnosticReport`) and formatted Markdown string (optionally writable to a local file path in tests/CLI).
   - Report summarises throughput, decision percentages per channel, quick-approve savings rate, cache hit ratio, slowest 5 traces, and audit hash-chain status.
   - Redacts any PII before export.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Yo mate, since this whole system runs offline with no Datadog or Grafana plugged in, we still want proper visibility after a simulation run. Build a `TelemetryReportBuilder` in `@sentinel/observability` that pulls together our metrics snapshot, slowest traces, audit chain integrity status, alert history, and decision breakdown per channel, then renders both a typed JSON object and a dead clean Markdown summary report. Make sure zero PII slips into the export and verify all stats match actual run counts in tests.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/observability/telemetry-report.test.ts`

---

## Epic 4: Caching Layer & Quick-Approve Engine (`FD-019` – `FD-024`)

### Ticket FD-019

1. **Title:** Bounded LRU + TTL In-Memory Cache with Eviction Callbacks & Cache Telemetry
2. **Description:**
   Upgrade `InMemoryTtlCache` in `@sentinel/storage` into a bounded O(1) Least-Recently-Used (LRU) + Time-To-Live (TTL) cache (`InMemoryLruTtlCache`) using JavaScript `Map` insertion ordering. Support `maxEntries`, sliding vs absolute expiration modes, eviction hooks (`EXPIRED` | `CAPACITY` | `MANUAL`), and integrated hit/miss/eviction metrics.
3. **Acceptance Criteria:**
   - `get`, `set`, and `delete` operate in O(1) time complexity and refresh recency on read hits.
   - Exceeding `maxEntries` evicts the least-recently-used entry and invokes the optional `onEvict(key, value, reason)` callback.
   - Supports both absolute TTL and optional sliding TTL (`touchOnGet`) driven purely by `IClock`.
   - Exposes `stats(): CacheStats` (`hits`, `misses`, `hitRate`, `evictionsByCapacity`, `evictionsByExpiry`, `currentSize`) and emits observability metrics.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Right bruv, an unbounded `Map` cache is basically a memory leak wearing a trench coat. Upgrade `@sentinel/storage` with a proper O(1) `InMemoryLruTtlCache` that caps entries via `maxEntries`, supports both fixed and sliding TTLs driven by `IClock`, and fires an `onEvict` callback telling you whether an item got booted for capacity, expiry, or manual delete. Track hits, misses, hit rate, and eviction counters cleanly, and pipe them into `IMetricsCollector`. Test LRU eviction order, sliding TTL refresh, and boundary capacity of 1.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/storage/lru-ttl-cache.test.ts`

---

### Ticket FD-020

1. **Title:** Cache-Aside, Write-Through & Single-Flight Stampede Protection Decorators
2. **Description:**
   Implement SOLID decorator wrappers around `ICache<T>` and repositories in `@sentinel/storage`: a `SingleFlightCacheLoader` that coalesces concurrent cache misses for the same key into a single underlying datastore fetch (preventing thundering-herd cache stampedes), plus `WriteThroughCacheRepository` and `NegativeCache` (caching short-lived "not found" markers cleanly).
3. **Acceptance Criteria:**
   - `SingleFlightCacheLoader.getOrLoad(key, loader, ttlMs)` guarantees that 50 concurrent calls for the same missing key trigger the underlying `loader()` exactly once.
   - If the shared in-flight `loader()` rejects, the in-flight map entry is cleaned up so subsequent requests retry cleanly.
   - `CachingTransactionRepository` and `CachingQuickApproveStore` decorate the underlying repositories via their interfaces without changing caller signatures (Open/Closed + Decorator pattern).
   - Metrics record `cache.stampede_coalesced`, `cache.hit`, and `cache.miss`.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Listen mate, imagine 100 transactions for a hot merchant or user hit an expired cache key at the exact same millisecond — without stampede protection, you hammer the datastore 100 times for no reason. Build a `SingleFlightCacheLoader` in `@sentinel/storage` that coalesces concurrent misses for the same key into one single load, plus clean Decorator wrappers (`CachingTransactionRepository` and `CachingQuickApproveStore`) implementing write-through invalidation/updates. Make sure failed loads clean up the in-flight promise so keys never get stuck forever. Prove with a 50-way `Promise.all` concurrency test that the loader only fires once.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/storage/cache-decorators-singleflight.test.ts`

---

### Ticket FD-021

1. **Title:** Per-User Quick-Approve Rule Engine & Multi-Attribute Fingerprint Matching
2. **Description:**
   Expand `QuickApproveRule` and `QuickApproveEvaluator` in `@sentinel/domain` and `@sentinel/processors` into a rich, expressive per-`userId` trust rule engine. Match future transactions on `userId`, `channel`, `vendorId`, `itemCategory`, `currency`, `amountRange` (`minAmountMinorUnits`..`maxAmountMinorUnits` or percentage tolerance around a baseline amount), optional `deviceFingerprint` / `atmId` / `destinationWallet` allowlist, and active time window (`validFromMs`..`validUntilMs`) with deterministic rule priority resolution.
3. **Acceptance Criteria:**
   - Supports matching by exact vendor, item category list/wildcard, amount tolerance band (e.g., `±15%` or explicit min/max), currency, channel, and optional device/ATM/wallet binding.
   - Works across all three channels (`INTERNET_PAYMENT` via vendor/item/device, `CASH_WITHDRAWAL` via trusted ATM/country/amount cap, `CRYPTO` via whitelisted destination wallet/asset/network/vendor).
   - When multiple rules match a transaction, selects the highest-priority / most-specific rule deterministically and records `matchedRuleId` and `matchedCriteria` in `ClassificationResult.factors`.
   - Rejects disabled, suspended, or expired rules immediately.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Alright bruv, this quick-approve feature is a massive USP for the service so let's make it proper sharp. Upgrade `QuickApproveRule` and `QuickApproveEvaluator` so per `userId`, it doesn't just do a basic `<= maxAmount` check on internet payments — support min/max amount bands or percentage tolerance, vendor + item category matching, currency, time window (`validFromMs` to `validUntilMs`), AND channel-specific bindings (device fingerprint for internet, trusted ATM/country for cash withdrawals, allowlisted destination wallet/network for crypto). If multiple rules match, resolve priority deterministically and log exact matched criteria in the risk factors. Test every channel and edge case properly.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/processors/quick-approve-matching.test.ts`

---

### Ticket FD-022

1. **Title:** Sliding Time-Window Velocity & Cumulative Spend Caps for Quick-Approve
2. **Description:**
   Prevent abuse of quick-approve rules by compromised accounts (e.g., an attacker replaying 50 small transactions right under the per-transaction cap). Add per-rule and per-user sliding-window quotas inside `QuickApproveEvaluator` enforcing `maxTransactionsInWindow` and `maxCumulativeAmountMinorUnits` within a rolling `windowDurationMs` (e.g., max 5 quick-approves or £500 total in any rolling 24-hour window). Exceeding the quota falls back safely to full ML scoring rather than auto-approving.
3. **Acceptance Criteria:**
   - `QuickApproveQuotaTracker` maintains sliding-window timestamps and cumulative minor-unit spend per `(userId, ruleId)` using `IClock`.
   - When a transaction would exceed either `maxTransactionsInWindow` or `maxCumulativeAmountMinorUnits`, quick-approve returns `{ matched: false, fallbackReason: "QUOTA_EXCEEDED" }` and routes the transaction to the ML engine with an added `QUICK_APPROVE_QUOTA_BREACHED` risk signal.
   - Advancing `ControllableClock` past the oldest transaction's window expiration automatically restores quota capacity.
   - Atomic check-and-reserve prevents race conditions under concurrent transactions for the same user.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Think about this one, mate — if a user's got a quick-approve rule for £50 at a coffee shop and a fraudster steals their session, they could fire 100 transactions of £49 back-to-back and drain the whole account. Long day! Build a `QuickApproveQuotaTracker` using sliding time windows powered by `IClock` that enforces both `maxTransactionsInWindow` and `maxCumulativeAmountMinorUnits` per rule. If a transaction breaches either cap, DO NOT quick-approve it — fall back straight to the ML engine and pass a `QUICK_APPROVE_QUOTA_BREACHED` signal so the model knows something's moody. Test rolling window expiry by advancing the clock and confirm concurrency doesn't double-spend the quota.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/processors/quick-approve-quotas.test.ts`

---

### Ticket FD-023

1. **Title:** Automatic Quick-Approve Learning, Trust Decay & Negative-Feedback Revocation
2. **Description:**
   Implement a `QuickApproveLifecycleManager` in `@sentinel/processors` that automatically promotes trusted recurring patterns into temporary per-`userId` quick-approve rules after `N` consecutive clean, low-risk `ACCEPTED` transactions for the same `(userId, channel, vendor, itemCategory, currency)` within a learning window. Conversely, if a user receives a `DECLINED` decision, a chargeback/fraud-confirmed feedback event, or high-risk anomaly, immediately revoke affected quick-approve rules and invalidate the user's cache.
3. **Acceptance Criteria:**
   - `recordOutcome(tx, classification)` updates per-user pattern counters and automatically mints a bounded `QuickApproveRule` (with conservative spend cap, e.g., `1.2x` observed max and TTL e.g., 7 days) once `minCleanOccurrences` is reached.
   - `handleFraudFeedback(userId, reason, scope)` revokes matching rules (or all rules for `userId`), records an audit entry, and immediately invalidates quick-approve caches.
   - Unused rules gradually lose trust/expire cleanly; clean reuse can optionally renew within a maximum lifetime cap.
   - Full lifecycle covered in unit tests: 3 clean purchases -> rule minted -> 4th purchase quick-approved -> fraud alert arrives -> rule revoked -> 5th purchase goes back to ML.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Safe bruv, manually seeding quick-approve rules is calm for setup, but a world-class engine learns from clean user behaviour and slams the brakes when things go sideways. Build a `QuickApproveLifecycleManager` in `@sentinel/processors` that watches `ACCEPTED` low-risk transactions — once a user nails, say, 3 clean transactions with the same vendor, item category, and currency, automatically mint a scoped quick-approve rule with a sensible cap and expiry window. Flip side: if we get a `DECLINED` result or a fraud-feedback event for that user, immediately nuke their quick-approve rules, purge the cache, and write an audit log entry. Test the full learn -> fast-track -> revoke -> fallback cycle end-to-end.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/processors/quick-approve-lifecycle.test.ts`

---

### Ticket FD-024

1. **Title:** Cache Maintenance Sweeper, Invalidation Event Bus & Consistency Guard
2. **Description:**
   Implement active cache maintenance across all caches (`decisionCache`, `quickApproveCache`, `userProfileCache`) via a `CacheMaintenanceCoordinator` and an event-driven `CacheInvalidationBus`. Support scheduled background sweeps (driven by `IClock` for deterministic offline testing), tag-based invalidation (e.g., invalidate all cache entries for `userId: "u-1"`), and cache warmup from repositories at startup.
3. **Acceptance Criteria:**
   - `CacheMaintenanceCoordinator` registers multiple named `ICache` instances and executes periodic `purgeExpired()` sweeps, reporting reclaimed entries to `IMetricsCollector`.
   - `CacheInvalidationBus` decouples writers (`QuickApproveLifecycleManager`, `UserProfileRepository`) from caches via typed invalidation events (`USER_RULES_CHANGED`, `USER_RISK_FLAGGED`, `DECISION_OVERRIDDEN`).
   - Startup `warmup()` pre-populates active quick-approve rules for top active users cleanly without blocking startup indefinitely.
   - Zero stale reads after rule updates or revocations across concurrent runs.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Yo mate, caches are wicked until they go stale or fill up with expired rubbish nobody ever reads again. Build a `CacheMaintenanceCoordinator` and an event-driven `CacheInvalidationBus` in `@sentinel/storage` so we're actively maintaining all our caches properly. Hook up periodic expiry sweeps driven by `IClock`, tag-based invalidations by `userId`, and a clean startup `warmup()` routine. When a quick-approve rule changes or a user gets flagged, publish an invalidation event so every cache clears out straight away without tight coupling between services. Test sweep stats, invalidation propagation, and zero stale reads.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/storage/cache-maintenance-invalidation.test.ts`

---

## Epic 5: Offline Datastores & Persistence Layer (`FD-025` – `FD-030`)

### Ticket FD-025

1. **Title:** Indexed In-Memory Transaction Repository with Rich Queries & Cursor Pagination
2. **Description:**
   Upgrade `InMemoryTransactionRepository` in `@sentinel/storage` from linear scans (`[...values()].filter(...)`) into a properly indexed offline datastore maintaining secondary indexes on `userId`, `channel`, `(userId, timestampMs)` sorted ranges, and `vendorId` / `atmId` / `destinationWallet`. Expose cursor-based pagination and sliding-window lookbacks (`findByUserInWindow(userId, fromMs, toMs)`) to power velocity features and analytics in O(log N) / O(K) time.
3. **Acceptance Criteria:**
   - Secondary indexes stay strictly consistent on `save` and `delete`, preventing stale index pointers.
   - `query(filter, page)` supports filtering by `userId`, `channel`, `currency`, `minAmount`, `maxAmount`, `fromMs`, `toMs`, and returns `{ items, nextCursor, totalMatched }`.
   - `findByUserInWindow(userId, fromMs, toMs)` returns chronologically sorted transactions without scanning unrelated users.
   - Deep-clones or freezes stored records on write/read so caller mutations cannot corrupt datastore state.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Alright bruv, doing full array scans in `InMemoryTransactionRepository` is gonna crawl the second we pump 10,000 transactions into it. Give it proper secondary indexes on `userId`, `channel`, and time-sorted user histories so `findByUserInWindow(userId, fromMs, toMs)` flies without touching other users' records. Add a proper `query(filter, pagination)` method with cursor pagination, and freeze or clone records on the way in and out so nobody mutates stored objects by mistake. Prove index accuracy, immutability, and pagination edge cases with thorough unit tests.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/storage/indexed-transaction-repo.test.ts`

---

### Ticket FD-026

1. **Title:** Classification Decision Store with Risk Explanation History & Override Versioning
2. **Description:**
   Upgrade `IClassificationRepository` in `@sentinel/storage` to persist immutable classification snapshots along with versioned history (supporting analyst/system review updates for `NEEDS_MORE_CHECKS` transactions that later transition to `ACCEPTED` or `DECLINED`), queryable by `decision`, `channel`, `modelVersion`, `quickApproved`, and `riskScore` bands.
3. **Acceptance Criteria:**
   - Initial classification is saved as `version: 1`; subsequent reviews/overrides append `version: 2+` with `reviewedBy`, `overrideReason`, and `updatedAtMs` without overwriting historical versions.
   - Provides aggregate reporting queries: `countByDecision(fromMs, toMs)`, `findPendingManualChecks(limit)`, and `findHistory(transactionId)`.
   - Attempting to override a non-existent transaction throws a typed `EntityNotFoundError`.
   - Emits metrics when `NEEDS_MORE_CHECKS` items are resolved.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Listen mate, when our system flags a transaction as `NEEDS_MORE_CHECKS`, it doesn't stay in limbo forever — later on a reviewer or secondary check flips it to `ACCEPTED` or `DECLINED`, and we must NEVER wipe out the original ML decision. Upgrade `IClassificationRepository` in `@sentinel/storage` to store immutable versioned decision histories (`version: 1, 2, ...`), plus query helpers like `findPendingManualChecks`, `countByDecision`, and `findHistory(transactionId)`. Throw a clean `EntityNotFoundError` if someone tries to override a ghost transaction. Test full version history and reporting queries thoroughly.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/storage/classification-history-repo.test.ts`

---

### Ticket FD-027

1. **Title:** User Risk Profile & Behavioural Baseline Repository
2. **Description:**
   Build an `IUserRiskProfileRepository` and `InMemoryUserRiskProfileRepository` in `@sentinel/storage` maintaining per-`userId` rolling behavioural baselines (Welford's online mean/variance for spend amounts, known device fingerprints, known countries/ATMs, known crypto wallets, historical accept/review/decline counts, and account risk tier `LOW` | `STANDARD` | `ELEVATED` | `BLOCKED`).
3. **Acceptance Criteria:**
   - Online Welford algorithm updates mean and standard deviation per `(userId, channel)` in O(1) memory without storing infinite raw arrays.
   - Tracks bounded sets of known devices, frequent vendors, home countries, and whitelisted/flagged wallets per user.
   - Exposes `computeSpendZScore(userId, channel, amountMinorUnits)` safely handling cold-start users (fewer than `N` historical transactions).
   - Supports manual or automated risk-tier escalation (`ELEVATED` / `BLOCKED`) and emits cache invalidation events on tier change.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Yo bruv, to mimic real fraud ML properly, we need to know what "normal" looks like for each user — £2,000 is pocket change for one customer and a massive red flag for someone who only buys £4 coffees. Build an `IUserRiskProfileRepository` in `@sentinel/storage` that tracks rolling behavioural baselines per user and channel using Welford's online mean/variance algorithm (O(1) memory, dead tidy), plus known devices, countries, ATMs, and wallets. Add a `computeSpendZScore` method that handles brand-new cold-start users gracefully without returning `NaN`. Test cold-start, drift updates, and risk-tier escalation cleanly.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/storage/user-risk-profile-repo.test.ts`

---

### Ticket FD-028

1. **Title:** Optimistic Concurrency Control, Unit-of-Work & Atomic Multi-Store Transactions
2. **Description:**
   Implement an offline `IUnitOfWork` coordinator in `@sentinel/storage` that groups mutations across `transactionRepo`, `classificationRepo`, `outboxStore`, and `userRiskProfileRepo` into an all-or-nothing atomic commit with rollback on failure, alongside optimistic concurrency control (`expectedVersion` checks throwing `ConcurrencyConflictError`) for mutable aggregates like user profiles and quick-approve rules.
3. **Acceptance Criteria:**
   - `UnitOfWork.execute(async (txContext) => ...)` stages writes and commits atomically; if any step throws, zero partial writes leak into any underlying repository.
   - Mutable entities (`UserRiskProfile`, `QuickApproveRule`) carry a monotonic `version` field; conflicting concurrent updates throw `ConcurrencyConflictError` (`retryable: true`).
   - `FraudGateway` wraps persistence of incoming transaction, classification, user baseline update, and outbox event inside a single Unit-of-Work boundary.
   - Verified with fault-injection tests triggering mid-transaction errors and concurrent version races.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Right mate, if we save the transaction, update the user's profile, and then blow up right before saving the classification and outbox record, our stores end up half-baked — total shambles. Build an offline `IUnitOfWork` in `@sentinel/storage` with staged writes and clean rollback on error, plus optimistic concurrency control (`version` checks throwing retryable `ConcurrencyConflictError`) on mutable records like user profiles and quick-approve rules. Wire `FraudGateway` through the Unit-of-Work and write fault-injection tests proving that a mid-flight crash leaves every single store completely untouched.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/storage/unit-of-work-occ.test.ts`

---

### Ticket FD-029

1. **Title:** Offline Local-Disk Snapshot Persistence & Deterministic Seed Dataset Loader
2. **Description:**
   Add an optional offline snapshot adapter (`JsonFileSnapshotManager`) in `@sentinel/storage` using only Node's `node:fs/promises` (zero network!) to export and restore the entire state of all in-memory datastores and caches to/from a local JSON snapshot file, plus a deterministic `SeedDatasetLoader` generating realistic synthetic UK/global banking personas, trusted quick-approve patterns, and known fraud rings for offline testing.
3. **Acceptance Criteria:**
   - `exportSnapshot()` serialises transactions, classifications, user profiles, quick-approve rules, and outbox state with a schema version and SHA-256 checksum.
   - `importSnapshot()` validates checksum integrity before hydrating stores (rejects corrupted files with `CorruptSnapshotError`).
   - `SeedDatasetLoader` uses `ISeededRandom` and `IClock` to generate reproducible datasets (`small`, `medium`, `stress`) covering all 3 channels and edge cases.
   - Round-trip save -> wipe memory -> reload produces 100% identical query results.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Safe bruv, even though everything runs in-memory offline, it's mega handy to dump state to a local JSON file and reload it for debugging or reproducible test runs. Build a `JsonFileSnapshotManager` in `@sentinel/storage` using only `node:fs/promises` and `node:crypto` — include a schema version and SHA-256 checksum so corrupt snapshots get rejected immediately. Alongside that, build a deterministic `SeedDatasetLoader` using `ISeededRandom` that creates realistic synthetic users, recurring vendor history, quick-approve rules, and dodgy crypto/ATM patterns across `small`, `medium`, and `stress` presets. Test the full round-trip and checksum tamper failure.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/storage/snapshot-and-seed.test.ts`

---

### Ticket FD-030

1. **Title:** Data Retention Policy, TTL Archiver & Storage Compaction Worker
2. **Description:**
   Mimic real datastore maintenance by building a `StorageCompactionWorker` and configurable `RetentionPolicy` in `@sentinel/storage`. Automatically archive or prune aged raw transactions, expired quick-approve rules, completed idempotency keys, and published outbox records based on `IClock`, emitting storage footprint metrics before and after compaction.
3. **Acceptance Criteria:**
   - `RetentionPolicy` configures independent retention windows for `transactions`, `classifications`, `publishedOutbox`, `expiredQuickApproveRules`, and `idempotencyKeys`.
   - `StorageCompactionWorker.runOnce()` compacts all registered stores, moves aged records to an optional `IColdArchiveSink`, and returns a detailed `CompactionSummary`.
   - Secondary indexes remain 100% consistent after compaction (zero orphaned keys or phantom query results).
   - Emits `storage.records_compacted` and `storage.active_records` metrics per store.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Listen mate, real datastores need housekeeping or they bloat up till everything grinds to a halt. Build a `RetentionPolicy` and `StorageCompactionWorker` in `@sentinel/storage` driven by `IClock` that trims expired quick-approve rules, old published outbox items, stale idempotency keys, and aged transactions (optionally handing them off to an offline `IColdArchiveSink`). Make sure secondary indexes stay spotless after records are pruned — no ghost pointers left behind. Write tests advancing the clock by 30/90 days and verify exact compaction counts and clean queries afterwards.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/storage/retention-compaction.test.ts`

---

## Epic 6: Offline Simulated ML & Risk Classification Engine (`FD-031` – `FD-036`)

### Ticket FD-031

1. **Title:** Pluggable Deterministic Feature Pipeline (Velocity, Spend Baselines, Novelty & Time Signals)
2. **Description:**
   Replace the minimal 4-field `DefaultFeatureExtractor` in `@sentinel/ml-engine` with a composable, deterministic `FeaturePipeline` executing pluggable `IFeatureContributor` modules against the incoming transaction, synthetic user baseline (`IUserRiskProfileRepository`), and recent transaction window (`ITransactionRepository`). Produce model-like inputs such as `amountVsBaseline`, `txCount1h`, `txCount24h`, `spendSum24hRatio`, `isNewDevice`, `isNighttimeLocal`, `timeSinceLastTxSec`, and `accountAgeDays`. This is feature simulation only: baselines are supplied fixture/profile data, not learned from training.
3. **Acceptance Criteria:**
   - `FeaturePipeline` composes ordered `IFeatureContributor` plugins and outputs a strongly typed `EnrichedFeatureVector`; all values are reproducible for identical inputs and fixture state.
   - Missing or cold-start signals use documented defaults (with explicit `isColdStart` indicator), never `NaN` or `Infinity`.
   - Adding a feature contributor requires zero changes to the pipeline orchestration.
   - Unit tests assert exact feature values for cold-start users, high-velocity bursts, and unusual spend against supplied synthetic baselines; no training or baseline fitting is introduced.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Build a deterministic, pluggable feature pipeline in `@sentinel/ml-engine` so the system looks and behaves like an ML service without doing actual machine learning. Contributors can derive velocity, spend-vs-supplied-baseline, device novelty, odd-hours, and time-since-last-transaction signals from the transaction history and synthetic profile fixtures. Define cold-start defaults, keep every output finite, and make the same inputs produce the same vector. Do not fit baselines or train anything.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/ml-engine/feature-pipeline.test.ts`

---

### Ticket FD-032

1. **Title:** Channel-Specific Simulated Risk Signals (Internet CNP, ATM Cash & On-Chain Crypto)
2. **Description:**
   Implement three deterministic channel feature contributors inside `@sentinel/ml-engine` registered via a channel strategy map. Use local synthetic fixtures and explicit rules only:
   - **Internet Payment (Card-Not-Present):** 3DS status, IP-to-home-country mismatch, high-risk merchant category code (MCC) weight, disposable/new device fingerprint, rapid vendor switching.
   - **Cash Withdrawal (ATM):** PIN/card-present verification, Haversine geo-distance & impossible-travel speed from previous ATM withdrawal, cross-border ATM risk, daily cash-limit proximity.
   - **Crypto:** Offline simulated flagged-wallet set lookup, newly seen destination wallet, high-risk bridge/chain marker, dust-then-drain pattern detection, large stablecoin/native transfer ratio.
3. **Acceptance Criteria:**
   - Each channel implements `IChannelFeatureExtractor<T>` and contributes named, deterministic signals to `EnrichedFeatureVector`; bounded numeric signals use `[0, 1]`.
   - Includes a pure TypeScript Haversine distance and travel-speed calculator for simulated ATM impossible-travel scenarios.
   - Sample MCC, flagged-wallet, and proxy/VPN fixtures live in local TypeScript modules and are clearly illustrative, not live threat intelligence.
   - Unit tests verify impossible travel, fixture-listed crypto destinations, and unverified CNP signals without external data or services.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Add channel-specific deterministic signal contributors for internet payments, ATM withdrawals, and crypto transfers. Use small local example fixtures for MCCs, flagged wallets, and proxy ranges, plus pure Haversine math for ATM travel scenarios. These are illustrative inputs for a simulated risk system, not real-time threat intelligence or learned patterns. Cover the key scenarios with exact offline tests.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/ml-engine/channel-feature-extractors.test.ts`

---

### Ticket FD-033

1. **Title:** Deterministic Simulated Risk Scorer & Versioned Score Profiles
2. **Description:**
   Implement a deterministic `SimulatedRiskModel` conforming to `IRiskModel` that consumes the feature vector and a versioned, hand-authored `SimulatedRiskProfile`. Profiles contain fixed signal weights and a bias; the scorer applies a documented weighted sum and clamps it to `[0, 1]`. This creates a plausible inference-shaped interface and repeatable scores without implementing statistical model algorithms.
3. **Acceptance Criteria:**
   - The simulated scorer strictly satisfies `IRiskModel` and returns a deterministic score in `[0, 1]` plus profile ID/version metadata.
   - Profiles are static, checked-in example configuration; validation rejects malformed ranges and unknown feature keys.
   - No training, fitting, imported model artifacts, logistic regression, decision trees, external ML packages, or claims of calibrated probabilities are included.
   - Unit tests verify exact weighted-score outputs, clamping, profile validation, and repeatability.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Implement one `SimulatedRiskModel` behind the existing `IRiskModel` interface. It should combine named feature signals with fixed, hand-authored weights from a small versioned profile and return a bounded, repeatable score. The goal is to mimic an inference service contract, not to build or train a real model: no regression, trees, fitting, or claims of statistical calibration. Add exact-output tests and reject invalid profiles.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/ml-engine/ml-models.test.ts`

---

### Ticket FD-034

1. **Title:** Simulated Profile Blending, Hard-Rule Overrides & Decision Policy
2. **Description:**
   Build a `SimulatedScoreCombiner` and `DecisionPolicyEngine` in `@sentinel/ml-engine` that optionally blends outputs from configured simulated profiles, applies deterministic hard-rule overrides (e.g., blocked user tier or fixture-listed crypto destination), and maps the resulting illustrative score to `ACCEPTED`, `NEEDS_MORE_CHECKS`, or `DECLINED` using channel-specific thresholds.
3. **Acceptance Criteria:**
   - The combiner supports configured weighted blending of simulated profiles and records which profiles contributed; no independent trained models are required.
   - `DecisionPolicyEngine` enforces per-channel thresholds and ordered `IHardRule` overrides.
   - Threshold configurations are validated (`0 < reviewThreshold < declineThreshold <= 1`) and scores are documented as simulation values, not calibrated fraud probabilities.
   - Unit tests cover boundary scores, hard-rule short-circuiting, and deterministic fallback behavior when an optional simulated profile fails.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Build a small deterministic combiner for configured simulated score profiles, then pass its score through channel-specific decision thresholds and ordered hard rules. Keep blocked-account and fixture-listed-wallet overrides independent of the score. Validate threshold bands and test boundary behavior, rule order, and optional-profile failure. These scores are for demonstrating a system flow, not representing a trained ensemble.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/ml-engine/ensemble-and-policy.test.ts`

---

### Ticket FD-035

1. **Title:** Deterministic Risk Explanations & Reason-Code Generator
2. **Description:**
   Implement an offline `IRiskExplainer` in `@sentinel/ml-engine` that maps the deterministic feature signals and triggered hard rules to ranked human-readable `RiskFactor` reason codes. For the simulated weighted scorer, expose each configured signal's simple score contribution; do not implement model-specific attribution methods.
3. **Acceptance Criteria:**
   - Produces deterministic ranked `RiskFactor[]` entries with stable reason codes and concise explanations derived from input signals and fixed profile weights.
   - Reported simulated contributions reconcile to the pre-clamp weighted score; explanations make no causal or statistical claims.
   - Configurable `topK` cap (default 5) limits signal reasons while always preserving triggered hard rules at the top.
   - Downstream notifications and classification storage preserve the ranked explanation.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Add deterministic explanations to the simulated classifier. Map known feature signals to stable reason codes, rank them using the configured profile's simple contribution values, and always place triggered hard rules first. Test ordering, the top-K cap, and reconciliation to the raw weighted score. Do not add logistic/boosted-tree attribution or describe these reasons as causal explanations.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/ml-engine/explainability.test.ts`

---

### Ticket FD-036

1. **Title:** Simulated Profile Comparison & Synthetic Scenario Behavior Report
2. **Description:**
   Build a `ShadowProfileRunner` around `IRiskModel` that runs a candidate simulated score profile alongside the active profile without affecting decisions, recording score and decision differences. Pair it with an offline `ScenarioBehaviorReporter` that runs fixed, labeled synthetic scenarios and summarizes expected-vs-actual decisions and basic confusion counts. This validates the demo wiring and configured examples only; it is not model training, model selection, or evidence of real-world performance.
3. **Acceptance Criteria:**
   - The runner always returns the active profile's prediction if the candidate profile fails and records a deterministic error metric/log.
   - Records profile score deltas and decision disagreements without changing live classifications.
   - The report computes expected-vs-actual decisions and `TP`, `FP`, `TN`, and `FN` for a small fixed synthetic scenario set; any derived rates are labeled illustrative.
   - Tests compare two checked-in simulated profiles over deterministic scenarios and assert that this is a behavior demonstration, not a training or accuracy benchmark.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Add a shadow runner that compares the active fixed score profile with a candidate profile, while always returning the active profile's result. Create a small offline report over labeled synthetic scenarios showing decision differences and confusion counts. Keep the candidate fault-isolated and the output clearly marked illustrative: no training, model selection, ROC claims, or real-world performance claims. Verify repeatability and failure handling with unit tests.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/ml-engine/shadow-and-evaluator.test.ts`

---

## Epic 7: Gateway Orchestration, Channel Processors & Clients (`FD-037` – `FD-042`)

### Ticket FD-037

1. **Title:** Dynamic Processor Registry, Composable Gateway Middleware Pipeline & Open/Closed Router
2. **Description:**
   Refactor `@sentinel/gateway` to introduce a clean `IGatewayMiddleware` chain (Onion/Chain-of-Responsibility pattern: `CorrelationMiddleware` -> `ValidationMiddleware` -> `IdempotencyMiddleware` -> `MetricsTimingMiddleware` -> `RoutingCore`) and upgrade `ProcessorRegistry` with duplicate-registration guards, health introspection, and hot-swappable channel handlers.
3. **Acceptance Criteria:**
   - `GatewayPipeline` executes registered `IGatewayMiddleware` components in deterministic order with proper `next()` short-circuiting and error propagation.
   - `ProcessorRegistry` supports `register`, `replace`, `unregister`, `has`, `listChannels`, and `resolve` with strict TypeScript generics and zero `any`.
   - Adding a mock 4th channel (e.g., `WIRE_TRANSFER` in a test) works cleanly without modifying a single line of `FraudGateway`.
   - All existing unit and E2E tests pass through the refactored pipeline.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Alright mate, `FraudGateway.handleEnvelope` is gonna turn into a massive God-function if we keep shoving logging, validation, caching, idempotency, and tracing straight into it. Refactor `@sentinel/gateway` around a crisp `IGatewayMiddleware` onion pipeline (`Correlation` -> `Validation` -> `Idempotency` -> `Timing` -> `CoreRouting`) and beef up `ProcessorRegistry` with `has`, `listChannels`, and duplicate-registration protection. Keep every single generic strictly typed — zero `any`. Write a test registering a brand-new custom processor dynamically to prove Open/Closed holds up proper tight.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/gateway/middleware-and-registry.test.ts`
   - `pnpm test`

---

### Ticket FD-038

1. **Title:** Production-Grade `InternetPaymentProcessor` (3DS, Device Velocity, Merchant Risk & Quick-Approve)
2. **Description:**
   Upgrade `InternetPaymentProcessor` in `@sentinel/processors` from a thin base-class subclass into a full domain-aware processor for e-commerce / internet payments. Incorporate pre-ML domain checks (e.g., blocked merchant list, velocity burst guard across multiple vendors from one IP/device), quick-approve fast-path evaluation with quota enforcement, enriched CNP feature scoring, and automatic post-decision learning updates into `QuickApproveLifecycleManager` and `UserRiskProfileRepository`.
3. **Acceptance Criteria:**
   - Enforces internet-payment domain policies: blocked vendor auto-decline, missing 3DS escalation above configurable GBP threshold, device-velocity anomaly tagging.
   - Integrates seamlessly with `QuickApproveEvaluator` (matching `vendorId`, `itemCategory`, `currency`, `amountRange`, `deviceFingerprint`, and time window).
   - Updates user behavioural baselines and quick-approve learning counters on clean `ACCEPTED` decisions, and triggers rule revocation on `DECLINED` decisions.
   - Emits channel-specific telemetry tags (`channel: "INTERNET_PAYMENT"`, `threeDs: "true"|"false"`).
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Safe bruv, time to put real meat on `InternetPaymentProcessor` in `@sentinel/processors`. Don't leave it as an empty two-line subclass — give it proper e-commerce fraud brains: blocked vendor checks, missing-3DS step-up rules above configurable thresholds, device/IP multi-vendor velocity checks, quick-approve evaluation with quota tracking, and post-decision learning hooks that feed clean outcomes into the user's profile and quick-approve learner (and revoke rules if declined). Keep dependencies cleanly injected via interfaces and cover every single branch in unit tests.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/processors/internet-payment-processor.test.ts`

---

### Ticket FD-039

1. **Title:** Production-Grade `CashWithdrawalProcessor` (ATM Geo-Velocity, Impossible Travel & Daily Cash Caps)
2. **Description:**
   Build out `CashWithdrawalProcessor` in `@sentinel/processors` with specialized physical-cash fraud controls: ATM location metadata lookup (offline registry mapping `atmId` -> latitude, longitude, country, risk tier), impossible-travel detection against the user's prior ATM withdrawals, card-not-present / unverified-PIN instant decline rules, rolling 24-hour cash withdrawal ceiling checks, and trusted-ATM quick-approve support.
3. **Acceptance Criteria:**
   - Offline `IAtmDirectory` maps known ATM IDs to geo coordinates and risk profiles (unknown ATMs receive an explicit `UNKNOWN_ATM` risk signal).
   - Detects impossible travel (e.g., > 900 km/h implied speed between consecutive withdrawals) and escalates/declines with `IMPOSSIBLE_ATM_TRAVEL` reason factor.
   - Enforces rolling 24h cumulative cash withdrawal limit per user via `ITransactionRepository.findByUserInWindow`.
   - Unverified PIN or `cardPresent === false` on cash withdrawal triggers strict risk penalty or hard decline per policy.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Yo mate, ATM cash fraud is brutal because once the notes come out the slot, that money's gone forever. Beef up `CashWithdrawalProcessor` in `@sentinel/processors` with an offline `IAtmDirectory` (mapping ATM IDs to coordinates, countries, and risk tiers), impossible-travel detection against the user's previous withdrawal (e.g., Brixton ATM then Madrid ATM 25 minutes later = instant red alert), rolling 24-hour daily cash cap enforcement, and hard checks on `pinVerified` and `cardPresent`. Support trusted-ATM quick-approve rules too, and smash out thorough unit tests covering every edge case.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/processors/cash-withdrawal-processor.test.ts`

---

### Ticket FD-040

1. **Title:** Production-Grade `CryptoTransactionProcessor` (Sanctions, Mixer Heuristics, Dusting & Whitelisted Wallets)
2. **Description:**
   Build out `CryptoTransactionProcessor` in `@sentinel/processors` with crypto-native fraud intelligence: offline sanctioned/mixer address screening (`ISanctionsRegistry`), self-transfer/circular-hop checks, newly-created/first-seen destination wallet cooling-off review (`NEEDS_MORE_CHECKS` for high-value transfers to unseen wallets), dusting-followed-by-drain sequence detection, network-specific risk weighting, and whitelisted-wallet quick-approve support.
3. **Acceptance Criteria:**
   - Any transfer touching a sanctioned/mixer source or destination wallet immediately yields `DECLINED` with `SANCTIONED_CRYPTO_ADDRESS` and bypasses quick-approve.
   - High-value transfers to a first-seen destination wallet trigger at least `NEEDS_MORE_CHECKS` unless covered by an active, non-quota-breached whitelisted-wallet quick-approve rule.
   - Detects classic "small probe / dust tx followed within minutes by large drain to same wallet" pattern using user history window.
   - Normalises crypto minor units to GBP equivalent via `IOfflineFxConverter` before applying value thresholds.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Right bruv, crypto transactions are irreversible — one mistake and it's curtains. Build out `CryptoTransactionProcessor` in `@sentinel/processors` with an offline `ISanctionsRegistry` for dodgy/mixer wallets (which MUST override even quick-approve and instantly `DECLINED`), GBP value normalisation via `IOfflineFxConverter`, first-seen destination wallet cooling-off checks (`NEEDS_MORE_CHECKS` on big sums), and a detector for the classic "tiny test transfer followed 2 minutes later by a massive wallet drain" scam. Support whitelisted-wallet quick-approve for trusted recurring transfers and test every single pattern rigorously.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/processors/crypto-transaction-processor.test.ts`

---

### Ticket FD-041

1. **Title:** Upstream Feed Client Simulator (Batch, Burst, Duplicate, Poison-Pill & Scenario Generators)
2. **Description:**
   Expand `@sentinel/clients`'s `IUpstreamFeedClient` / `MockUpstreamFeedClient` with realistic offline upstream ingestion capabilities: batch publishing (`submitBatch`), deterministic traffic-pattern generators (`SteadyStreamScenario`, `FlashSaleBurstScenario`, `CredentialStuffingAttackScenario`, `CryptoDrainAttackScenario`), intentional duplicate injection, malformed poison-pill injection, and schema-versioned payload emission.
3. **Acceptance Criteria:**
   - Supports single and batch ingestion with backpressure awareness and delivery receipt summaries (`accepted`, `rejected`, `correlationIds`).
   - Built-in deterministic scenario builders driven by `ISeededRandom` and `IClock` generate realistic multi-channel traffic streams with known ground-truth fraud labels.
   - Supports configurable fault injection (e.g., 2% duplicate envelopes, 1% malformed payloads) to test queue idempotency and DLQ pipelines cleanly.
   - Zero network usage; 100% reproducible given the same seed.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Safe mate, right now our upstream client only fires one transaction at a time — we need to mimic a proper busy upstream payment switch offline. Upgrade `MockUpstreamFeedClient` in `@sentinel/clients` to handle batch publishing with backpressure receipts, plus build deterministic traffic scenario generators (using `ISeededRandom` and `IClock`): normal mixed traffic, flash-sale bursts, credential-stuffing attacks, impossible-travel ATM fraud, and crypto drain attempts, with optional duplicate and poison-pill injection rates. Make sure every generated stream is 100% reproducible from a seed and prove it in unit tests.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/clients/upstream-simulator.test.ts`

---

### Ticket FD-042

1. **Title:** Downstream Notification Client with Circuit Breaker, Retries, HMAC Signing & Delivery Receipts
2. **Description:**
   Elevate `IDownstreamNotifierClient` and `InMemoryDownstreamNotifierClient` in `@sentinel/clients` to mimic production webhook/event-sink delivery: deterministic HMAC-SHA256 payload signatures (`X-Sentinel-Signature`), idempotency keys per notification, configurable simulated downstream latency/failure injection, a three-state `CircuitBreaker` (`CLOSED` | `OPEN` | `HALF_OPEN`) driven by `IClock`, and structured `DeliveryReceipt` tracking.
3. **Acceptance Criteria:**
   - Every notification is signed using `node:crypto` HMAC-SHA256 with a shared offline secret and includes a `verifySignature(notification, secret)` utility for downstream consumers.
   - `CircuitBreaker` trips to `OPEN` after `N` consecutive simulated downstream failures, fast-fails calls while open, transitions to `HALF_OPEN` after cooldown (`IClock`), and closes cleanly on probe success.
   - Supports multi-subscriber fan-out (`CompositeDownstreamNotifier`) so multiple simulated downstream consumers (e.g., Payment Settlement Service + Fraud Ops Case Manager) can subscribe independently.
   - Full unit tests verify HMAC verification, circuit-breaker state transitions, and fan-out isolation.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Listen bruv, notifying downstream clients in the real world is messy — webhooks time out, services flap, and consumers need to verify the payload wasn't spoofed. Upgrade `InMemoryDownstreamNotifierClient` in `@sentinel/clients` with HMAC-SHA256 payload signing (plus a `verifySignature` helper), a proper three-state `CircuitBreaker` (`CLOSED` -> `OPEN` -> `HALF_OPEN`) powered by `IClock`, simulated downstream failure/latency knobs for testing, and a `CompositeDownstreamNotifier` for multi-client fan-out (like Settlement + Fraud Ops). Test every circuit-breaker transition and signature check cleanly.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/clients/downstream-notifier-cb.test.ts`

---

## Epic 8: End-to-End Verification, Resilience, Performance & Documentation (`FD-043` – `FD-048`)

### Ticket FD-043

1. **Title:** Comprehensive End-to-End Scenario Suite (All Channels, Quick-Approve Lifecycle & Edge Cases)
2. **Description:**
   Build a thorough suite of offline E2E tests in `tests/e2e/` exercising the entire wired monorepo (`createOfflineFraudSystem`) across realistic multi-step customer journeys: normal accepted flows, medium-risk `NEEDS_MORE_CHECKS` -> manual override transitions, high-risk `DECLINED` flows, quick-approve automatic learning -> fast-track -> quota fallback -> fraud revocation, cross-channel user risk escalation, and full audit-chain + trace-tree verification.
3. **Acceptance Criteria:**
   - At least 12 distinct multi-step E2E scenarios covering all 3 channels (`INTERNET_PAYMENT`, `CASH_WITHDRAWAL`, `CRYPTO`), quick-approve lifecycle, outbox relay, cache invalidation, and observability assertions.
   - Every E2E scenario asserts: stored raw transaction, stored classification + reason factors, valid HMAC-signed downstream notification, intact hash-chained audit ledger, and zero unexpected DLQ entries.
   - Runs completely deterministically offline in under 5 seconds total.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Alright mate, we've got all the pieces built — now let's put the whole machine through its paces properly. Build a comprehensive E2E test suite under `tests/e2e/` wiring the full system via `createOfflineFraudSystem` with zero mocks on internal domain logic. Cover at least 12 realistic journeys: all three channels (`ACCEPTED`, `NEEDS_MORE_CHECKS`, `DECLINED`), auto-learned quick-approve -> fast-track -> quota cap breach -> fraud revocation, impossible ATM travel, sanctioned crypto instant decline, and manual review overrides. On every test, verify stored requests, stored decisions, signed downstream receipts, trace trees, and audit ledger integrity.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm test:e2e`

---

### Ticket FD-044

1. **Title:** Chaos & Fault-Injection Resilience Suite (Queue Drops, Store Faults, Slow ML & Downstream Outages)
2. **Description:**
   Create an offline chaos testing harness (`tests/e2e/chaos-resilience.e2e.test.ts`) using fault-injecting decorators around storage, caches, ML challenger models, and downstream clients. Verify that the system recovers gracefully without data loss or duplicate side effects under transient datastore failures, concurrency conflicts, downstream outages (circuit breaker + outbox replay), duplicate queue bursts, and malformed poison pills.
3. **Acceptance Criteria:**
   - Fault-injection decorators (`FaultyStorageDecorator`, `FaultyDownstreamDecorator`) support deterministic failure schedules (e.g., fail attempts 1 & 2, succeed on 3).
   - Proves zero lost transactions across transient failures once retries and outbox relay complete.
   - Proves poison pills route directly to DLQ without stalling healthy transactions in the same batch, and succeed after fix + `requeueFromDlq`.
   - Proves downstream circuit-breaker recovery and zero duplicate downstream notifications under 3x duplicate queue replays.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Yo bruv, happy-path tests are easy — world-class backends prove they survive when everything's on fire. Build an offline chaos test suite in `tests/e2e/chaos-resilience.e2e.test.ts` with clean fault-injecting decorators for storage, ML challenger models, and downstream clients. Hammer the system with transient storage errors, optimistic concurrency clashes, poison-pill messages, 3x duplicate bursts, and a full downstream outage that trips the circuit breaker. Prove that once things stabilise and the outbox/retries run, zero valid transactions are lost, zero duplicates get double-notified, and poison pills land neatly in the DLQ ready for replay.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/e2e/chaos-resilience.e2e.test.ts`

---

### Ticket FD-045

1. **Title:** Offline Throughput, Latency & Memory Benchmark Harness
2. **Description:**
   Build a reproducible offline performance benchmark suite (`tests/benchmarks/pipeline.bench.ts` + runnable script `pnpm bench`) measuring end-to-end throughput (transactions/sec), P50/P95/P99 latency across quick-approved vs full-ML paths, cache hit-rate impact, and heap memory stability under 10,000+ transactions with compaction enabled.
3. **Acceptance Criteria:**
   - Benchmark script processes 10,000 deterministic mixed-channel transactions offline and outputs a formatted Markdown + JSON benchmark summary (TPS, P50/P95/P99 ms, quick-approve ratio, cache hit ratio, peak heap delta).
   - Regression test asserts performance floor targets (e.g., > 1,500 TPS offline local throughput, P99 latency < 15ms, zero unbounded cache growth past `maxEntries`).
   - Runs cleanly via `pnpm bench` and `pnpm vitest run tests/e2e/performance-guard.test.ts`.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Safe mate, we want numbers, not vibes. Build an offline benchmark harness (`pnpm bench`) that blasts 10,000 deterministic mixed-channel transactions through the whole fraud pipeline and spits out exact TPS, P50/P95/P99 latency for both quick-approve and full-ML paths, cache hit rates, and heap memory delta. Also add a fast regression test in `tests/e2e/performance-guard.test.ts` asserting sane latency and memory bounds so nobody accidentally introduces an O(N^2) bottleneck later. Pure offline, zero external deps.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm bench`
   - `pnpm vitest run tests/e2e/performance-guard.test.ts`

---

### Ticket FD-046

1. **Title:** Security, Privacy & Contract Compliance Test Suite (PII Guards, Idempotency & Zero-Network Proof)
2. **Description:**
   Create a dedicated compliance & contract verification test suite (`tests/e2e/security-compliance.e2e.test.ts`) auditing the entire system for: (1) zero PII leakage across logs, metrics tags, error messages, and exported telemetry reports; (2) strict offline zero-network guarantees across all packages; (3) audit hash-chain tamper immunity; (4) HMAC signature forgery rejection; and (5) TypeScript contract tests ensuring every concrete adapter adheres identically to its interface specification.
3. **Acceptance Criteria:**
   - Runs a battery of transactions containing canary PII values (e.g., `"CANARY_IP_203.0.113.77"`, `"CANARY_SECRET_PIN_9941"`) and asserts zero raw occurrences appear in any log sink, metric tag, or diagnostic export.
   - Contract test suite validates all `ICache`, `ITransactionRepository`, `IRiskModel`, and `IMessageQueue` implementations against shared behavioural test harnesses (proving Liskov Substitution).
   - Verifies forged or modified downstream notifications fail `verifySignature`.
   - Verifies zero outbound network attempts throughout the entire run.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Listen bruv, before we call this system world-class, let's lock down security and SOLID contracts properly. Build `tests/e2e/security-compliance.e2e.test.ts` with canary PII strings injected into transactions and prove not a single raw secret or unmasked IP leaks into logs, metric tags, error messages, or telemetry reports. Add shared Liskov Substitution contract test suites for our cache, repo, model, and queue interfaces, verify HMAC forgery rejection on downstream notifications, and confirm zero network calls across the entire run. Dead thorough, mate.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/e2e/security-compliance.e2e.test.ts`

---

### Ticket FD-047

1. **Title:** Architecture Decision Records (ADRs), Sequence Diagrams & Developer Onboarding Playbook
2. **Description:**
   Produce comprehensive, publication-grade engineering documentation under `docs/`:
   - `docs/adr/001-monorepo-hexagonal-solid.md`
   - `docs/adr/002-partitioned-event-queue-outbox.md`
   - `docs/adr/003-quick-approve-cache-and-quotas.md`
   - `docs/adr/004-offline-ml-ensemble-and-xai.md`
   - `docs/sequences.md` (Mermaid sequence diagrams for Happy Path, Quick-Approve Fast Path, Impossible Travel Decline, and Retry/DLQ Recovery)
   - `docs/onboarding.md` (step-by-step guide to adding a new channel, swapping a datastore/ML model, and running offline diagnostics)
   Update root `README.md` with accurate package stats, scripts, and links to every doc.
3. **Acceptance Criteria:**
   - All 4 ADRs follow the standard Context / Decision / Consequences / Trade-offs format and accurately reference real files and interfaces in the repository.
   - All Mermaid diagrams render cleanly and reflect the actual class/method names implemented across tickets `FD-001`–`FD-046`.
   - An automated doc-verification test checks that every internal file path and npm script referenced in `README.md` and `docs/*.md` actually exists in the workspace (zero dead links or stale docs).
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Alright mate, brilliant code with dusty, outdated docs is a classic rookie trap. Write proper production-grade documentation under `docs/`: four crisp ADRs covering our SOLID monorepo boundaries, partitioned queue + outbox, quick-approve caching + quotas, and offline ML ensemble/XAI; a `docs/sequences.md` packed with clean Mermaid sequence diagrams for every major flow; and a `docs/onboarding.md` showing any new dev how to plug in a new channel or swap out an adapter in 10 minutes flat. Refresh `README.md` and write a neat doc-link verifier test so every file path and script mentioned in Markdown is guaranteed to exist.
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/docs-integrity.test.ts`
   - `pnpm typecheck`

---

### Ticket FD-048

1. **Title:** Interactive Offline CLI Simulator & One-Command Full System Verification Runner
2. **Description:**
   Build a zero-dependency TypeScript CLI package/entrypoint (`services/gateway/src/cli.ts`, runnable via `pnpm simulate`) that executes selectable offline fraud scenarios (`standard`, `attack`, `quick-approve-demo`, `chaos`), drains the queue and outbox, verifies audit chain integrity, prints a rich terminal dashboard (channel counts, decision breakdown, quick-approve hit rate, ML P95 latency, alerts), and optionally writes the full Markdown + JSON diagnostic report to `./reports/`. Add a single `pnpm verify:all` script proving the entire monorepo builds, typechecks, passes all unit/E2E/chaos/compliance tests, and completes a clean simulation run offline.
3. **Acceptance Criteria:**
   - `pnpm simulate -- --scenario standard --seed 42 --count 500` runs completely offline, exits with code `0`, and prints a clean structured summary plus optional report output.
   - Supports `--scenario`, `--seed`, `--count`, `--report-out <path>`, and `--fail-on-dlq` CLI flags parsed with pure TypeScript (zero external CLI libs).
   - `pnpm verify:all` executes `typecheck` -> `build` -> `test:unit` -> `test:e2e` -> `simulate --scenario standard --count 250 --fail-on-dlq` in one command.
   - CLI argument parser and runner are covered by unit and integration tests asserting exit codes and output sections.
4. **Prompts to Give the AI Programmer (Modern London English):**
   > Last ticket on the board, bruv — let's finish proper strong! Build a zero-dependency TypeScript CLI runner in `services/gateway/src/cli.ts` (`pnpm simulate`) so anyone can fire up offline simulations (`standard`, `attack`, `quick-approve-demo`, `chaos`) with flags like `--seed`, `--count`, `--report-out`, and `--fail-on-dlq`, and watch a crisp summary dashboard print straight to the terminal (throughput, decision breakdown, quick-approve rate, P95 latency, audit-chain status). Wire up a master `pnpm verify:all` script that runs typecheck, build, every test suite, and a live offline simulation in one clean sweep. Test the CLI flags, exit codes, and report generation — job done, world-class!
5. **Tests to Run to Prove Completion of Ticket:**
   - `pnpm vitest run tests/unit/gateway/cli-simulator.test.ts`
   - `pnpm simulate -- --scenario quick-approve-demo --seed 42 --count 200 --fail-on-dlq`
   - `pnpm verify:all`
