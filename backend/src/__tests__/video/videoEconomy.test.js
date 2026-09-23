import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIDEO_PRICING,
  DEFAULT_VIDEO_TERMS,
  assertAcceptedQuote,
  prepareCitizenVideoUpload,
  getCurrentVideoTerms,
  resolveVideoPricingForSize,
  sanitizeVideoPricing,
  sanitizeVideoTerms,
} from "../../video/services/videoEconomy.js";

function makeDoc(data) {
  return {
    exists: Boolean(data),
    data: () => data || {},
  };
}

function makeDb({ pricing, terms } = {}) {
  return {
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (name === "platform_settings" && id === "citizen_video_pricing") {
                return makeDoc(pricing ? { currentVersion: pricing.version } : null);
              }
              if (name === "platform_settings" && id === "citizen_video_terms") {
                return makeDoc(terms ? { currentVersion: terms.version } : null);
              }
              if (name === "video_pricing_versions") return makeDoc(pricing);
              if (name === "video_terms_versions") return makeDoc(terms);
              return makeDoc(null);
            },
          };
        },
      };
    },
  };
}

describe("Citizen video economy foundation", () => {
  it("defaults launch pricing to zero fees and disabled wallet/deletion enforcement", () => {
    const pricing = sanitizeVideoPricing(DEFAULT_VIDEO_PRICING);
    expect(pricing.videoFeesEnabled).toBe(false);
    expect(pricing.automaticWalletDeductionEnabled).toBe(false);
    expect(pricing.automaticDeletionEnabled).toBe(false);
    expect(pricing.currency).toBe("PARAG");
    expect(pricing.tiers.every((tier) => tier.uploadFee === 0 && tier.monthlyMaintenanceFee === 0)).toBe(true);
  });

  it("resolves exact size tier boundaries", () => {
    const pricing = sanitizeVideoPricing({
      ...DEFAULT_VIDEO_PRICING,
      videoFeesEnabled: true,
      tiers: [
        { minBytes: 0, maxBytes: 100, uploadFee: 1, monthlyMaintenanceFee: 2 },
        { minBytes: 101, maxBytes: 250, uploadFee: 3, monthlyMaintenanceFee: 4 },
      ],
    });
    expect(resolveVideoPricingForSize(pricing, 100)).toMatchObject({ uploadFee: 1, monthlyMaintenanceFee: 2 });
    expect(resolveVideoPricingForSize(pricing, 101)).toMatchObject({ uploadFee: 3, monthlyMaintenanceFee: 4 });
  });

  it("requires accepted current pricing and terms before authorization", () => {
    const pricing = sanitizeVideoPricing({ ...DEFAULT_VIDEO_PRICING, version: "p1" });
    const terms = sanitizeVideoTerms({ ...DEFAULT_VIDEO_TERMS, version: "t1" });
    expect(() => assertAcceptedQuote({ pricing, terms, body: {}, fileSizeBytes: 1 })).toThrow(/accepted/i);
    expect(() => assertAcceptedQuote({
      pricing,
      terms,
      body: {
        acceptedTerms: true,
        pricingVersion: "old",
        termsVersion: "t1",
        uploadFeeAccepted: 0,
        monthlyMaintenanceAccepted: 0,
      },
      fileSizeBytes: 1,
    })).toThrow(/changed/i);
    expect(assertAcceptedQuote({
      pricing,
      terms,
      body: {
        acceptedTerms: true,
        pricingVersion: "p1",
        termsVersion: "t1",
        uploadFeeAccepted: 0,
        monthlyMaintenanceAccepted: 0,
      },
      fileSizeBytes: 1,
    })).toMatchObject({ uploadFee: 0, monthlyMaintenanceFee: 0 });
  });

  it("loads current policy and returns a snapshottable zero-price quote", async () => {
    const result = await prepareCitizenVideoUpload({
      db: makeDb({
        pricing: sanitizeVideoPricing({ ...DEFAULT_VIDEO_PRICING, version: "pricing-current" }),
        terms: sanitizeVideoTerms({ ...DEFAULT_VIDEO_TERMS, version: "terms-current" }),
      }),
      fileSizeBytes: 1024,
    });
    expect(result.quote).toMatchObject({
      pricingVersion: "pricing-current",
      termsVersion: "terms-current",
      uploadFee: 0,
      monthlyMaintenanceFee: 0,
      currency: "PARAG",
    });
  });

  it("fails closed when no published terms version is designated", async () => {
    await expect(getCurrentVideoTerms(makeDb())).rejects.toThrow(/No published Citizen Video Terms/i);
  });

  it("does not accept a draft terms version as current production terms", async () => {
    const draft = sanitizeVideoTerms({ ...DEFAULT_VIDEO_TERMS, version: "draft-1", status: "draft" });
    await expect(getCurrentVideoTerms(makeDb({ terms: draft }))).rejects.toThrow(/No published Citizen Video Terms/i);
  });
});
