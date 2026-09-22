import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_VIDEO_PRICING, sanitizeVideoPricing } from "../../video/services/videoEconomy.js";

const root = resolve(process.cwd(), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

describe("Citizen Video Admin contract", () => {
  it("renders a top-level Citizen Video Admin entry and gates the dashboard by Admin claim", () => {
    const admin = read("frontend/src/pages/Admin.jsx");
    expect(admin).toContain("Citizen Video");
    expect(admin).toContain('setActiveTab("citizen-video")');
    expect(admin).toContain('token.claims?.admin === true');
    expect(admin).toContain("Admin permission required");
  });

  it("exposes every required Citizen Video section", () => {
    const panel = read("frontend/src/pages/admin/CitizenVideoAdmin.jsx");
    for (const section of [
      "Overview", "Uploads", "Video Pricing", "Storage & Maintenance",
      "Viewing & Watch Time", "Video Economics", "Billing & Payment Status",
      "Video Lifecycle / Deletion", "Terms & Conditions", "System / Processing Status",
    ]) expect(panel).toContain(section);
    expect(panel).toContain("Provider cost data pending reconciliation");
  });

  it("protects every Citizen Video Admin API with authentication and Admin authorization", () => {
    const routes = read("backend/src/video/routes/video.routes.js");
    const adminRoutes = routes.split("\n").filter((line) => line.includes('router.') && line.includes('"/admin/'));
    expect(adminRoutes.length).toBeGreaterThanOrEqual(9);
    adminRoutes.forEach((line) => {
      expect(line).toContain("authenticate");
      expect(line).toContain("requireAdmin");
    });
  });

  it("keeps launch pricing, deductions, deletion, and every tier at zero/off", () => {
    const pricing = sanitizeVideoPricing(DEFAULT_VIDEO_PRICING);
    expect(pricing.videoFeesEnabled).toBe(false);
    expect(pricing.automaticWalletDeductionEnabled).toBe(false);
    expect(pricing.automaticDeletionEnabled).toBe(false);
    expect(pricing.tiers.every((tier) => tier.uploadFee === 0 && tier.monthlyMaintenanceFee === 0)).toBe(true);
  });

  it("uses Citizen-domain bounded queries for Admin video data", () => {
    const controller = read("backend/src/video/controllers/videoAdmin.controller.js");
    expect(controller).toContain('.where("contentDomain", "==", "citizen")');
    expect(controller).toContain("limit + 1");
    expect(controller).toContain("nextCursor");
  });
});
