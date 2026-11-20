import { describe, expect, it } from "vitest";
import {
  FRAUD_DECISIONS,
  FixedClock,
  TRANSACTION_CHANNELS,
} from "@sentinel/domain";
import { createOfflineFraudSystem } from "@sentinel/gateway";

describe("End-to-end offline fraud detection pipeline", () => {
  it("ingests all three channels from upstream queue, stores outcomes, and notifies downstream", async () => {
    const clock = new FixedClock(1_760_000_000_000);
    const sys = createOfflineFraudSystem(clock);

    await sys.upstreamClient.submitTransaction({
      transactionId: "tx-e2e-internet",
      userId: "u-1",
      channel: TRANSACTION_CHANNELS.INTERNET_PAYMENT,
      amountMinorUnits: 12_000,
      currency: "GBP",
      timestampMs: clock.now(),
      vendorId: "v-1",
      itemCategory: "groceries",
      ipAddress: "198.51.100.2",
      deviceFingerprint: "fp-1",
      threeDsVerified: true,
    });

    await sys.upstreamClient.submitTransaction({
      transactionId: "tx-e2e-cash",
      userId: "u-2",
      channel: TRANSACTION_CHANNELS.CASH_WITHDRAWAL,
      amountMinorUnits: 300_000,
      currency: "GBP",
      timestampMs: clock.now(),
      atmId: "atm-ldn-09",
      countryCode: "GB",
      pinVerified: false,
      cardPresent: true,
    });

    await sys.upstreamClient.submitTransaction({
      transactionId: "tx-e2e-crypto",
      userId: "u-3",
      channel: TRANSACTION_CHANNELS.CRYPTO,
      amountMinorUnits: 500_000,
      currency: "USDC",
      timestampMs: clock.now(),
      assetSymbol: "USDC",
      sourceWallet: "0x1111",
      destinationWallet: "0xbad9999",
      network: "ethereum",
    });

    const processed = await sys.queue.drain();

    expect(processed).toBe(3);
    expect(sys.queue.deadLetters()).toHaveLength(0);
    expect(sys.downstreamClient.delivered).toHaveLength(3);
    expect(sys.tracer.spans.length).toBeGreaterThanOrEqual(3);

    const cash = await sys.classificationRepo.findByTransactionId("tx-e2e-cash");
    const crypto = await sys.classificationRepo.findByTransactionId("tx-e2e-crypto");

    expect(cash?.decision).toBe(FRAUD_DECISIONS.DECLINED);
    expect(crypto?.decision).toBe(FRAUD_DECISIONS.DECLINED);
  });
});
