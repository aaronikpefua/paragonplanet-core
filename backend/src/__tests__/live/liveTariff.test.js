import { describe, expect, it } from "vitest";
import { DEFAULT_LIVE_TARIFF, liveSettlementDecision, sanitizeLiveTariff } from "../../live/liveTariff.js";

describe("Paragon Live 30-minute tariff", () => {
  it("defaults to free access with every financial switch off", () => {
    expect(DEFAULT_LIVE_TARIFF).toMatchObject({
      currency: "PARAG", chargingUnitMinutes: 30,
      broadcasterPricePer30Min: 0, viewerPricePer30Min: 0,
      broadcasterChargingEnabled: false, viewerChargingEnabled: false,
      financialEnforcementEnabled: false,
    });
  });

  it("does not infer enforcement from a non-zero price", () => {
    expect(sanitizeLiveTariff({ broadcasterPricePer30Min: 10 })).toMatchObject({
      broadcasterPricePer30Min: 10, broadcasterChargingEnabled: false, financialEnforcementEnabled: false,
    });
  });

  it("rejects negative prices at the policy boundary", () => {
    expect(sanitizeLiveTariff({ viewerPricePer30Min: -4 }).viewerPricePer30Min).toBe(0);
  });

  it("grants zero-price access without a wallet mutation", () => {
    expect(liveSettlementDecision(DEFAULT_LIVE_TARIFF, "broadcaster")).toEqual({ price: 0, roleEnabled: false, settlementRequired: false, amountCharged: 0, walletMutationApplied: false });
    expect(liveSettlementDecision(DEFAULT_LIVE_TARIFF, "viewer").walletMutationApplied).toBe(false);
  });
});
