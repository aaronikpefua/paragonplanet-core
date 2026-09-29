import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseStreamWebhookPayload,
  processCitizenStreamWebhook,
  verifyStreamWebhookSignature,
} from "../../video/services/cloudflareStreamWebhook.js";
import { reconciliationRecoveryDelaySeconds } from "../../video/services/videoReconciliationTasks.js";

class FakeDb {
  constructor({ videos = {}, jobs = {} } = {}) {
    this.data = { videos: structuredClone(videos), video_reconciliation_jobs: structuredClone(jobs) };
    this.transactionQueue = Promise.resolve();
  }

  collection(name) {
    const db = this;
    return {
      doc(id) {
        return { collection: name, id };
      },
      where(field, _operator, value) {
        return {
          limit(maximum) {
            return {
              async get() {
                const docs = Object.entries(db.data[name] || {})
                  .filter(([, record]) => record[field] === value)
                  .slice(0, maximum)
                  .map(([id]) => db.snapshot({ collection: name, id }));
                return { docs, empty: docs.length === 0, size: docs.length };
              },
            };
          },
        };
      },
    };
  }

  snapshot(ref) {
    const value = this.data[ref.collection]?.[ref.id];
    return {
      id: ref.id,
      ref,
      exists: Boolean(value),
      data: () => value ? structuredClone(value) : undefined,
    };
  }

  runTransaction(callback) {
    const run = async () => callback({
      get: async (ref) => this.snapshot(ref),
      set: (ref, value, options = {}) => {
        const current = this.data[ref.collection]?.[ref.id] || {};
        this.data[ref.collection] ||= {};
        this.data[ref.collection][ref.id] = options.merge ? { ...current, ...value } : structuredClone(value);
      },
    });
    const result = this.transactionQueue.then(run, run);
    this.transactionQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}

function readyPayload(overrides = {}) {
  return {
    uid: "stream-1",
    readyToStream: true,
    readyToStreamAt: "2026-09-28T17:40:34.049713Z",
    status: { state: "ready" },
    meta: { videoId: "video-1" },
    ...overrides,
  };
}

function database(video = {}, job = {}) {
  return new FakeDb({
    videos: { "video-1": { streamUid: "stream-1", feedEligible: false, streamReady: false, ...video } },
    jobs: { "video-1": { status: "queued", attempts: 1, ...job } },
  });
}

const timestamp = () => "SERVER_TIMESTAMP";

describe("Cloudflare Stream Citizen video webhook", () => {
  it("accepts a valid READY payload idempotently", async () => {
    const db = database();
    const result = await processCitizenStreamWebhook({ db, payload: readyPayload(), serverTimestamp: timestamp });
    expect(result.outcome).toBe("ready");
    expect(db.data.videos["video-1"]).toMatchObject({ streamReady: true, feedEligible: true, lifecycleStatus: "READY" });
    expect(db.data.video_reconciliation_jobs["video-1"]).toMatchObject({ status: "done", recoveryMode: "webhook", nextRetryAt: null });
  });

  it("records a valid failure without making the asset eligible", async () => {
    const db = database();
    const result = await processCitizenStreamWebhook({
      db,
      payload: readyPayload({ readyToStream: false, status: { state: "error", errReasonCode: "ERR_MALFORMED_VIDEO" } }),
      serverTimestamp: timestamp,
    });
    expect(result.outcome).toBe("failed");
    expect(db.data.videos["video-1"]).toMatchObject({ streamReady: false, feedEligible: false, processingStatus: "processing_failed" });
    expect(db.data.video_reconciliation_jobs["video-1"].status).toBe("failed");
  });

  it("rejects an invalid signature", () => {
    expect(verifyStreamWebhookSignature({
      rawBody: Buffer.from("{}"),
      signatureHeader: `time=1000,sig1=${"0".repeat(64)}`,
      secret: "secret",
      nowSeconds: 1000,
    })).toBe(false);
  });

  it("treats duplicate READY delivery as harmless", async () => {
    const db = database({ streamReady: true, feedEligible: true, lifecycleStatus: "READY" }, { status: "done" });
    const result = await processCitizenStreamWebhook({ db, payload: readyPayload(), serverTimestamp: timestamp });
    expect(result.outcome).toBe("duplicate_ready");
  });

  it("does not regress READY after a stale processing payload", async () => {
    const db = database({ streamReady: true, feedEligible: true, lifecycleStatus: "READY" }, { status: "done" });
    const result = await processCitizenStreamWebhook({
      db,
      payload: readyPayload({ readyToStream: false, status: { state: "inprogress" } }),
      serverTimestamp: timestamp,
    });
    expect(result.outcome).toBe("stale_processing_ignored");
    expect(db.data.videos["video-1"].feedEligible).toBe(true);
  });

  it("ignores an unknown Stream UID safely", async () => {
    const db = database();
    const result = await processCitizenStreamWebhook({ db, payload: readyPayload({ uid: "unknown" }), serverTimestamp: timestamp });
    expect(result.outcome).toBe("unknown_uid");
  });

  it("rejects missing and malformed payloads", () => {
    expect(parseStreamWebhookPayload(Buffer.from("{}"))).toBeNull();
    expect(parseStreamWebhookPayload(Buffer.from("not-json"))).toBeNull();
  });

  it("retains delayed deterministic recovery when a webhook is missed", () => {
    const delay = reconciliationRecoveryDelaySeconds(1, "video-1");
    expect(delay).toBe(reconciliationRecoveryDelaySeconds(1, "video-1"));
    expect(delay).toBeGreaterThanOrEqual(300);
    expect(delay).toBeLessThanOrEqual(599);
  });

  it("handles concurrent duplicate READY deliveries without duplicate state", async () => {
    const db = database();
    const results = await Promise.all([
      processCitizenStreamWebhook({ db, payload: readyPayload(), serverTimestamp: timestamp }),
      processCitizenStreamWebhook({ db, payload: readyPayload(), serverTimestamp: timestamp }),
    ]);
    expect(results.map((result) => result.outcome).sort()).toEqual(["duplicate_ready", "ready"]);
    expect(db.data.video_reconciliation_jobs["video-1"].status).toBe("done");
  });

  it("verifies the documented time.rawBody HMAC contract", () => {
    const rawBody = Buffer.from(JSON.stringify(readyPayload()));
    const time = "1000";
    const secret = "webhook-secret";
    const sig1 = crypto.createHmac("sha256", secret).update(`${time}.${rawBody.toString("utf8")}`).digest("hex");
    expect(verifyStreamWebhookSignature({
      rawBody,
      signatureHeader: `time=${time},sig1=${sig1}`,
      secret,
      nowSeconds: 1000,
    })).toBe(true);
  });
});
