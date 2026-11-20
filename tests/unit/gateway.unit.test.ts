import { describe, expect, it } from "vitest";
import {
  FRAUD_DECISIONS,
  FixedClock,
  TRANSACTION_CHANNELS,
  type InternetPaymentTransaction,
} from "@sentinel/domain";
import { createOfflineFraudSystem } from "@sentinel/gateway";

describe("FraudGateway unit tests", () => {
  it("classifies a low-risk verified internet payment as ACCEPTED", async () => {
    const sys = createOfflineFraudSystem(new FixedClock(1_760_000_000_000));
    const tx: InternetPaymentTransaction = {
      transactionId: "tx-net-001",
      userId: "user-42",
      channel: TRANSACTION_CHANNELS.INTERNET_PAYMENT,
      amountMinorUnits: 4_500,
      currency: "GBP",
      timestampMs: sys.clock.now(),
      vendorId: "vendor-coffee-ldn",
      itemCategory: "food_and_drink",
      ipAddress: "198.51.100.12",
      deviceFingerprint: "dev-abc",
      threeDsVerified: true,
    };

    const envelope = await sys.upstreamClient.submitTransaction(tx, "corr-1");
    const result = await sys.gateway.handleEnvelope(envelope);

    expect(result.decision).toBe(FRAUD_DECISIONS.ACCEPTED);
    expect(result.quickApproved).toBe(false);
    expect(await sys.classificationRepo.findByTransactionId("tx-net-001")).toEqual(result);
  });

  it("bypasses ML scoring when an active userId quick-approve rule matches", async () => {
    const clock = new FixedClock(1_760_000_000_000);
    const sys = createOfflineFraudSystem(clock);

    await sys.quickApproveStore.upsertRule({
      ruleId: "qa-rule-1",
      userId: "user-99",
      channel: TRANSACTION_CHANNELS.INTERNET_PAYMENT,
      vendorId: "vendor-tech-uk",
      itemCategory: "electronics",
      currency: "GBP",
      maxAmountMinorUnits: 500_000,
      validFromMs: clock.now() - 1_000,
      validUntilMs: clock.now() + 3_600_000,
    });

    const highValueTx: InternetPaymentTransaction = {
      transactionId: "tx-qa-001",
      userId: "user-99",
      channel: TRANSACTION_CHANNELS.INTERNET_PAYMENT,
      amountMinorUnits: 320_000,
      currency: "GBP",
      timestampMs: clock.now(),
      vendorId: "vendor-tech-uk",
      itemCategory: "electronics",
      ipAddress: "203.0.113.5",
      deviceFingerprint: "dev-xyz",
      threeDsVerified: false,
    };

    const envelope = await sys.upstreamClient.submitTransaction(highValueTx, "corr-qa");
    const result = await sys.gateway.handleEnvelope(envelope);

    expect(result.decision).toBe(FRAUD_DECISIONS.ACCEPTED);
    expect(result.quickApproved).toBe(true);
  });
});
