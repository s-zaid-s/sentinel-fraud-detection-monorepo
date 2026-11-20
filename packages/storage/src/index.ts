import type {
  ClassificationResult,
  IClock,
  QuickApproveRule,
  TransactionRecord,
} from "@sentinel/domain";

export interface ICache<TValue> {
  get(key: string): TValue | undefined;
  set(key: string, value: TValue, ttlMs: number): void;
  delete(key: string): void;
  purgeExpired(): number;
  size(): number;
}

export interface ITransactionRepository {
  save(tx: TransactionRecord): Promise<void>;
  findById(transactionId: string): Promise<TransactionRecord | undefined>;
  findByUserId(userId: string): Promise<readonly TransactionRecord[]>;
}

export interface IClassificationRepository {
  save(result: ClassificationResult): Promise<void>;
  findByTransactionId(transactionId: string): Promise<ClassificationResult | undefined>;
  findAll(): Promise<readonly ClassificationResult[]>;
}

export interface IQuickApproveStore {
  upsertRule(rule: QuickApproveRule): Promise<void>;
  findActiveRules(userId: string, nowMs: number): Promise<readonly QuickApproveRule[]>;
  purgeExpired(nowMs: number): Promise<number>;
}

interface CacheEntry<TValue> {
  readonly value: TValue;
  readonly expiresAtMs: number;
}

export class InMemoryTtlCache<TValue> implements ICache<TValue> {
  private readonly store = new Map<string, CacheEntry<TValue>>();
  private readonly clock: IClock;

  constructor(clock: IClock) {
    this.clock = clock;
  }

  get(key: string): TValue | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.clock.now() > entry.expiresAtMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: TValue, ttlMs: number): void {
    this.store.set(key, { value, expiresAtMs: this.clock.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  purgeExpired(): number {
    const now = this.clock.now();
    let purged = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAtMs) {
        this.store.delete(key);
        purged += 1;
      }
    }
    return purged;
  }

  size(): number {
    return this.store.size;
  }
}

export class InMemoryTransactionRepository implements ITransactionRepository {
  private readonly records = new Map<string, TransactionRecord>();

  async save(tx: TransactionRecord): Promise<void> {
    this.records.set(tx.transactionId, tx);
  }

  async findById(transactionId: string): Promise<TransactionRecord | undefined> {
    return this.records.get(transactionId);
  }

  async findByUserId(userId: string): Promise<readonly TransactionRecord[]> {
    return [...this.records.values()].filter((tx) => tx.userId === userId);
  }
}

export class InMemoryClassificationRepository implements IClassificationRepository {
  private readonly results = new Map<string, ClassificationResult>();

  async save(result: ClassificationResult): Promise<void> {
    this.results.set(result.transactionId, result);
  }

  async findByTransactionId(transactionId: string): Promise<ClassificationResult | undefined> {
    return this.results.get(transactionId);
  }

  async findAll(): Promise<readonly ClassificationResult[]> {
    return [...this.results.values()];
  }
}

export class InMemoryQuickApproveStore implements IQuickApproveStore {
  private readonly byUser = new Map<string, Map<string, QuickApproveRule>>();

  async upsertRule(rule: QuickApproveRule): Promise<void> {
    let userRules = this.byUser.get(rule.userId);
    if (!userRules) {
      userRules = new Map<string, QuickApproveRule>();
      this.byUser.set(rule.userId, userRules);
    }
    userRules.set(rule.ruleId, rule);
  }

  async findActiveRules(userId: string, nowMs: number): Promise<readonly QuickApproveRule[]> {
    const userRules = this.byUser.get(userId);
    if (!userRules) return [];
    return [...userRules.values()].filter(
      (rule) => nowMs >= rule.validFromMs && nowMs <= rule.validUntilMs,
    );
  }

  async purgeExpired(nowMs: number): Promise<number> {
    let purged = 0;
    for (const userRules of this.byUser.values()) {
      for (const [ruleId, rule] of userRules.entries()) {
        if (nowMs > rule.validUntilMs) {
          userRules.delete(ruleId);
          purged += 1;
        }
      }
    }
    return purged;
  }
}
