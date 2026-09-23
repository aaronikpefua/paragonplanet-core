import { describe, expect, it } from "vitest";
import { getCitizenVideoAdminTermsState } from "../../video/controllers/videoAdmin.controller.js";

function doc(id, data) {
  return { id, exists: Boolean(data), data: () => data || {} };
}

function makeDb({ pointer = "", records = [] } = {}) {
  return {
    collection(name) {
      return {
        doc(id) {
          return { async get() {
            if (name === "platform_settings" && id === "citizen_video_terms") return doc(id, pointer ? { currentVersion: pointer } : null);
            if (name === "video_terms_versions") return records.find((item) => item.id === id) || doc(id, null);
            return doc(id, null);
          } };
        },
        orderBy() {
          return { limit() { return { async get() { return { docs: records }; } }; } };
        },
      };
    },
  };
}

describe("Citizen Video Admin terms recovery", () => {
  it("returns the latest draft and warning without requiring published terms", async () => {
    const draft = doc("draft-1", { version: "draft-1", status: "draft", title: "Draft", body: "Review me" });
    const state = await getCitizenVideoAdminTermsState(makeDb({ records: [draft] }));
    expect(state.terms).toMatchObject({ version: "draft-1", status: "draft" });
    expect(state.publication.hasPublishedTerms).toBe(false);
    expect(state.publication.warning).toMatch(/uploads are temporarily blocked/i);
  });

  it("reports an explicitly published current version as authoritative", async () => {
    const published = doc("published-1", { version: "published-1", status: "published", title: "Terms", body: "Approved text" });
    const state = await getCitizenVideoAdminTermsState(makeDb({ pointer: "published-1", records: [published] }));
    expect(state.publication).toMatchObject({ hasPublishedTerms: true, authoritativeVersion: "published-1" });
    expect(state.terms.status).toBe("published");
  });
});
