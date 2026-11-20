export const TRANSACTION_CHANNELS = {
  INTERNET_PAYMENT: "INTERNET_PAYMENT",
  CASH_WITHDRAWAL: "CASH_WITHDRAWAL",
  CRYPTO: "CRYPTO",
} as const;

export type TransactionChannel =
  (typeof TRANSACTION_CHANNELS)[keyof typeof TRANSACTION_CHANNELS];

export const FRAUD_DECISIONS = {
  ACCEPTED: "ACCEPTED",
  NEEDS_MORE_CHECKS: "NEEDS_MORE_CHECKS",
  DECLINED: "DECLINED",
} as const;

export type FraudDecision =
  (typeof FRAUD_DECISIONS)[keyof typeof FRAUD_DECISIONS];

export interface BaseTransaction {
  readonly transactionId: string;
  readonly userId: string;
  readonly amountMinorUnits: number;
  readonly currency: string;
  readonly timestampMs: number;
  readonly channel: TransactionChannel;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface InternetPaymentTransaction extends BaseTransaction {
  readonly channel: typeof TRANSACTION_CHANNELS.INTERNET_PAYMENT;
  readonly vendorId: string;
  readonly itemCategory: string;
  readonly ipAddress: string;
  readonly deviceFingerprint: string;
  readonly threeDsVerified: boolean;
}

export interface CashWithdrawalTransaction extends BaseTransaction {
  readonly channel: typeof TRANSACTION_CHANNELS.CASH_WITHDRAWAL;
  readonly atmId: string;
  readonly countryCode: string;
  readonly pinVerified: boolean;
  readonly cardPresent: boolean;
}

export interface CryptoTransaction extends BaseTransaction {
  readonly channel: typeof TRANSACTION_CHANNELS.CRYPTO;
  readonly assetSymbol: string;
  readonly sourceWallet: string;
  readonly destinationWallet: string;
  readonly network: string;
  readonly vendorId?: string;
  readonly itemCategory?: string;
}

export type TransactionRecord =
  | InternetPaymentTransaction
  | CashWithdrawalTransaction
  | CryptoTransaction;

export interface EventEnvelope<TPayload> {
  readonly eventId: string;
  readonly correlationId: string;
  readonly topic: string;
  readonly producedAtMs: number;
  readonly attempt: number;
  readonly payload: TPayload;
}

export interface RiskFactor {
  readonly code: string;
  readonly weight: number;
  readonly detail: string;
}

export interface ClassificationResult {
  readonly transactionId: string;
  readonly userId: string;
  readonly channel: TransactionChannel;
  readonly decision: FraudDecision;
  readonly riskScore: number;
  readonly modelVersion: string;
  readonly quickApproved: boolean;
  readonly factors: readonly RiskFactor[];
  readonly evaluatedAtMs: number;
}

export interface QuickApproveRule {
  readonly ruleId: string;
  readonly userId: string;
  readonly channel: TransactionChannel;
  readonly vendorId: string;
  readonly itemCategory: string;
  readonly currency: string;
  readonly maxAmountMinorUnits: number;
  readonly validFromMs: number;
  readonly validUntilMs: number;
}

export interface DownstreamNotification {
  readonly notificationId: string;
  readonly correlationId: string;
  readonly classification: ClassificationResult;
  readonly dispatchedAtMs: number;
}

export interface IClock {
  now(): number;
}

export class SystemClock implements IClock {
  now(): number {
    return Date.now();
  }
}

export class FixedClock implements IClock {
  private currentMs: number;

  constructor(initialMs: number) {
    this.currentMs = initialMs;
  }

  now(): number {
    return this.currentMs;
  }

  advanceBy(deltaMs: number): void {
    this.currentMs += deltaMs;
  }
}
