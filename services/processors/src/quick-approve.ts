import type {
  IClock,
  QuickApproveRule,
  TransactionRecord,
} from "@sentinel/domain";
import { TRANSACTION_CHANNELS } from "@sentinel/domain";
import type { ICache, IQuickApproveStore } from "@sentinel/storage";

export interface QuickApproveMatch {
  readonly matched: boolean;
  readonly rule?: QuickApproveRule;
}

export class QuickApproveEvaluator {
  private readonly store: IQuickApproveStore;
  private readonly cache: ICache<readonly QuickApproveRule[]>;
  private readonly clock: IClock;
  private readonly cacheTtlMs: number;

  constructor(
    store: IQuickApproveStore,
    cache: ICache<readonly QuickApproveRule[]>,
    clock: IClock,
    cacheTtlMs = 60_000,
  ) {
    this.store = store;
    this.cache = cache;
    this.clock = clock;
    this.cacheTtlMs = cacheTtlMs;
  }

  async evaluate(tx: TransactionRecord): Promise<QuickApproveMatch> {
    const fingerprint = this.extractMatchAttributes(tx);
    if (!fingerprint) return { matched: false };

    const nowMs = this.clock.now();
    const cacheKey = `qa:${tx.userId}`;
    let rules = this.cache.get(cacheKey);
    if (!rules) {
      rules = await this.store.findActiveRules(tx.userId, nowMs);
      this.cache.set(cacheKey, rules, this.cacheTtlMs);
    }

    const match = rules.find(
      (r) =>
        r.channel === tx.channel &&
        r.vendorId === fingerprint.vendorId &&
        r.itemCategory === fingerprint.itemCategory &&
        r.currency === tx.currency &&
        tx.amountMinorUnits <= r.maxAmountMinorUnits &&
        nowMs >= r.validFromMs &&
        nowMs <= r.validUntilMs,
    );

    return match ? { matched: true, rule: match } : { matched: false };
  }

  invalidateUser(userId: string): void {
    this.cache.delete(`qa:${userId}`);
  }

  private extractMatchAttributes(
    tx: TransactionRecord,
  ): { vendorId: string; itemCategory: string } | undefined {
    if (tx.channel === TRANSACTION_CHANNELS.INTERNET_PAYMENT) {
      return { vendorId: tx.vendorId, itemCategory: tx.itemCategory };
    }
    if (tx.channel === TRANSACTION_CHANNELS.CRYPTO && tx.vendorId && tx.itemCategory) {
      return { vendorId: tx.vendorId, itemCategory: tx.itemCategory };
    }
    return undefined;
  }
}
