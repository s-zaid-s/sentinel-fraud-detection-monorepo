import {
  FRAUD_DECISIONS,
  TRANSACTION_CHANNELS,
  type FraudDecision,
  type RiskFactor,
  type TransactionRecord,
} from "@sentinel/domain";

export interface FeatureVector {
  readonly amountMajorUnits: number;
  readonly channelBaseRisk: number;
  readonly verificationPenalty: number;
  readonly highValueFlag: number;
}

export interface ModelPrediction {
  readonly riskScore: number;
  readonly decision: FraudDecision;
  readonly modelVersion: string;
  readonly factors: readonly RiskFactor[];
}

export interface IFeatureExtractor {
  extract(tx: TransactionRecord): FeatureVector;
}

export interface IRiskModel {
  readonly version: string;
  predict(tx: TransactionRecord, features: FeatureVector): Promise<ModelPrediction>;
}

export class DefaultFeatureExtractor implements IFeatureExtractor {
  extract(tx: TransactionRecord): FeatureVector {
    const amountMajorUnits = tx.amountMinorUnits / 100;
    let channelBaseRisk = 0.1;
    let verificationPenalty = 0;

    if (tx.channel === TRANSACTION_CHANNELS.INTERNET_PAYMENT) {
      channelBaseRisk = 0.15;
      verificationPenalty = tx.threeDsVerified ? 0 : 0.35;
    } else if (tx.channel === TRANSACTION_CHANNELS.CASH_WITHDRAWAL) {
      channelBaseRisk = 0.2;
      verificationPenalty = tx.pinVerified && tx.cardPresent ? 0 : 0.5;
    } else {
      channelBaseRisk = 0.35;
      verificationPenalty = tx.destinationWallet.startsWith("0xbad") ? 0.55 : 0.1;
    }

    return {
      amountMajorUnits,
      channelBaseRisk,
      verificationPenalty,
      highValueFlag: amountMajorUnits >= 2_500 ? 1 : 0,
    };
  }
}

export class HeuristicMockRiskModel implements IRiskModel {
  readonly version = "mock-ml-v0.1.0";

  async predict(
    _tx: TransactionRecord,
    features: FeatureVector,
  ): Promise<ModelPrediction> {
    const factors: RiskFactor[] = [
      { code: "CHANNEL_PRIOR", weight: features.channelBaseRisk, detail: "Channel baseline risk" },
    ];

    let rawScore = features.channelBaseRisk;

    if (features.verificationPenalty > 0) {
      rawScore += features.verificationPenalty;
      factors.push({
        code: "VERIFICATION_GAP",
        weight: features.verificationPenalty,
        detail: "Missing strong verification signal",
      });
    }

    if (features.highValueFlag === 1) {
      rawScore += 0.3;
      factors.push({
        code: "HIGH_VALUE",
        weight: 0.3,
        detail: `Amount ${features.amountMajorUnits.toFixed(2)} exceeds review threshold`,
      });
    }

    const riskScore = Math.min(1, Number(rawScore.toFixed(4)));
    const decision = this.scoreToDecision(riskScore);
    return { riskScore, decision, modelVersion: this.version, factors };
  }

  private scoreToDecision(score: number): FraudDecision {
    if (score >= 0.75) return FRAUD_DECISIONS.DECLINED;
    if (score >= 0.4) return FRAUD_DECISIONS.NEEDS_MORE_CHECKS;
    return FRAUD_DECISIONS.ACCEPTED;
  }
}
