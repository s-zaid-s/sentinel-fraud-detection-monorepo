import {
  FRAUD_DECISIONS,
  TRANSACTION_CHANNELS,
  type CashWithdrawalTransaction,
  type ClassificationResult,
  type CryptoTransaction,
  type IClock,
  type InternetPaymentTransaction,
  type TransactionRecord,
} from "@sentinel/domain";
import type { IFeatureExtractor, IRiskModel } from "@sentinel/ml-engine";
import type { ILogger } from "@sentinel/observability";
import type { QuickApproveEvaluator } from "./quick-approve.js";

export interface ITransactionProcessor<T extends TransactionRecord = TransactionRecord> {
  readonly channel: T["channel"];
  process(tx: T): Promise<ClassificationResult>;
}

export interface ProcessorDeps {
  readonly featureExtractor: IFeatureExtractor;
  readonly riskModel: IRiskModel;
  readonly quickApprove: QuickApproveEvaluator;
  readonly clock: IClock;
  readonly logger: ILogger;
}

abstract class BaseTransactionProcessor<T extends TransactionRecord>
  implements ITransactionProcessor<T>
{
  abstract readonly channel: T["channel"];
  protected readonly deps: ProcessorDeps;

  constructor(deps: ProcessorDeps) {
    this.deps = deps;
  }

  async process(tx: T): Promise<ClassificationResult> {
    const qa = await this.deps.quickApprove.evaluate(tx);
    if (qa.matched && qa.rule) {
      this.deps.logger.info("Transaction matched quick-approve rule", {
        transactionId: tx.transactionId,
        ruleId: qa.rule.ruleId,
      });
      return {
        transactionId: tx.transactionId,
        userId: tx.userId,
        channel: tx.channel,
        decision: FRAUD_DECISIONS.ACCEPTED,
        riskScore: 0.01,
        modelVersion: "quick-approve-bypass",
        quickApproved: true,
        factors: [
          { code: "QUICK_APPROVE_RULE", weight: -1, detail: `Matched user rule ${qa.rule.ruleId}` },
        ],
        evaluatedAtMs: this.deps.clock.now(),
      };
    }

    const features = this.deps.featureExtractor.extract(tx);
    const prediction = await this.deps.riskModel.predict(tx, features);
    return {
      transactionId: tx.transactionId,
      userId: tx.userId,
      channel: tx.channel,
      decision: prediction.decision,
      riskScore: prediction.riskScore,
      modelVersion: prediction.modelVersion,
      quickApproved: false,
      factors: prediction.factors,
      evaluatedAtMs: this.deps.clock.now(),
    };
  }
}

export class InternetPaymentProcessor extends BaseTransactionProcessor<InternetPaymentTransaction> {
  readonly channel = TRANSACTION_CHANNELS.INTERNET_PAYMENT;
}

export class CashWithdrawalProcessor extends BaseTransactionProcessor<CashWithdrawalTransaction> {
  readonly channel = TRANSACTION_CHANNELS.CASH_WITHDRAWAL;
}

export class CryptoTransactionProcessor extends BaseTransactionProcessor<CryptoTransaction> {
  readonly channel = TRANSACTION_CHANNELS.CRYPTO;
}
