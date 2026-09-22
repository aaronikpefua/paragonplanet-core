import { beforeEach, describe, expect, it, vi } from "vitest";

let fakeDb;

vi.mock("../../config/firebase.js", () => ({
  default: {
    firestore: Object.assign(
      () => fakeDb,
      {
        FieldPath: {
          documentId: () => "__name__",
        },
        Timestamp: {
          fromMillis: (millis) => ({ toMillis: () => millis }),
        },
        FieldValue: {
          serverTimestamp: () => ({ serverTimestamp: true }),
        },
      }
    ),
  },
}));

const { classifyVideoForFeed, listVideos } = await import("../../video/controllers/video.controller.js");

function createdAt(ms) {
  return { toMillis: () => ms };
}

function makeVideo(id, createdAtMs, overrides = {}) {
  return {
    id,
    uid: `user-${id}`,
    title: `Video ${id}`,
    category: "Singer",
    objectPath: `videos/${id}.mp4`,
    streamUrl: `https://cdn.example/${id}.mp4`,
    originalUrl: `https://cdn.example/${id}.mp4`,
    fileUrl: `https://cdn.example/${id}.mp4`,
    status: "active",
    processingStatus: "ready",
    lifecycleStatus: "READY",
    contentDomain: "citizen",
    visibility: "home",
    uploadPurpose: "home_video",
    source: "citizen_upload",
    createdAt: createdAt(createdAtMs),
    feedKind: "home",
    feedEligible: true,
    ...overrides,
  };
}

function makeDoc(id, data) {
  return {
    id,
    ref: { id },
    exists: true,
    data: () => data,
  };
}

class FakeQuery {
  constructor(db, collectionName) {
    this.db = db;
    this.collectionName = collectionName;
    this.filters = [];
    this.orders = [];
    this.after = null;
    this.max = Infinity;
  }

  where(field, operator, value) {
    this.filters.push({ field, operator, value });
    return this;
  }

  orderBy(field, direction = "asc") {
    this.orders.push({ field, direction });
    return this;
  }

  startAfter(createdAtCursor, idCursor) {
    this.after = {
      createdAtMillis: createdAtCursor?.toMillis?.() || 0,
      id: idCursor,
    };
    return this;
  }

  limit(value) {
    this.max = value;
    return this;
  }

  async get() {
    let rows = [...(this.db.data[this.collectionName] || [])];
    for (const filter of this.filters) {
      rows = rows.filter((row) => {
        const value = filter.field === "__name__" ? row.id : row.data[filter.field];
        if (filter.operator === "==") return value === filter.value;
        if (filter.operator === "in") return filter.value.includes(value);
        return true;
      });
    }

    if (this.collectionName === "videos") {
      rows.sort((left, right) => {
        const leftTime = left.data.createdAt?.toMillis?.() || 0;
        const rightTime = right.data.createdAt?.toMillis?.() || 0;
        if (rightTime !== leftTime) return rightTime - leftTime;
        return right.id.localeCompare(left.id);
      });
      if (this.after) {
        rows = rows.filter((row) => {
          const rowTime = row.data.createdAt?.toMillis?.() || 0;
          if (rowTime < this.after.createdAtMillis) return true;
          if (rowTime > this.after.createdAtMillis) return false;
          return row.id.localeCompare(this.after.id) < 0;
        });
      }
    }

    const docs = rows.slice(0, this.max).map((row) => makeDoc(row.id, row.data));
    return {
      empty: docs.length === 0,
      docs,
    };
  }
}

function makeDb({ videos = [], merchantProducts = [], profiles = {} } = {}) {
  return {
    data: {
      videos: videos.map((data) => ({ id: data.id, data })),
      merchant_products: merchantProducts.map((data, index) => ({ id: data.id || `product-${index}`, data })),
    },
    collection(name) {
      return {
        doc: (id) => ({
          id,
          get: async () => {
            const profile = profiles[id];
            return {
              id,
              exists: Boolean(profile),
              data: () => profile || {},
            };
          },
        }),
        where: (...args) => new FakeQuery(this, name).where(...args),
        orderBy: (...args) => new FakeQuery(this, name).orderBy(...args),
      };
    },
    async getAll(...refs) {
      return refs.map((ref) => ({
        id: ref.id,
        exists: Boolean(profiles[ref.id]),
        data: () => profiles[ref.id] || {},
      }));
    },
  };
}

function makeReq(query = {}) {
  return {
    query,
    get: () => "",
  };
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("Citizen video feed pagination", () => {
  beforeEach(() => {
    fakeDb = makeDb();
  });

  it("classifies current home-feed rules into durable feed fields", () => {
    expect(classifyVideoForFeed(makeVideo("home", 3))).toMatchObject({
      contentDomain: "citizen",
      feedEligible: true,
      feedKind: "home",
    });
    expect(classifyVideoForFeed(makeVideo("deleted", 2, { status: "DELETED" }))).toMatchObject({
      feedEligible: false,
    });
    expect(classifyVideoForFeed(makeVideo("market", 1, { uploadPurpose: "merchant_product" }))).toMatchObject({
      feedEligible: false,
      feedKind: "marketplace",
    });
  });

  it("returns an empty paginated feed without reading all videos", async () => {
    fakeDb = makeDb();
    const res = makeRes();
    await listVideos(makeReq(), res);
    expect(res.body).toEqual({ items: [], nextCursor: "", hasMore: false, pageSize: 20 });
  });

  it("returns fewer than one page with profile enrichment", async () => {
    fakeDb = makeDb({
      videos: [makeVideo("a", 3000), makeVideo("b", 2000)],
      profiles: { "user-a": { displayName: "Citizen A" } },
    });
    const res = makeRes();
    await listVideos(makeReq({ pageSize: "20" }), res);
    expect(res.body.items.map((item) => item.videoId)).toEqual(["a", "b"]);
    expect(res.body.items[0].displayName).toBe("Citizen A");
    expect(res.body.hasMore).toBe(false);
  });

  it("returns exactly one full page without a cursor when there is no next page", async () => {
    fakeDb = makeDb({
      videos: Array.from({ length: 20 }, (_, index) => makeVideo(`v${index}`, 2000 - index)),
    });
    const res = makeRes();
    await listVideos(makeReq({ pageSize: "20" }), res);
    expect(res.body.items).toHaveLength(20);
    expect(res.body.nextCursor).toBe("");
    expect(res.body.hasMore).toBe(false);
  });

  it("handles exactly one page and multiple pages with stable newest-first cursors", async () => {
    fakeDb = makeDb({
      videos: Array.from({ length: 45 }, (_, index) => makeVideo(`v${index}`, 100000 - index)),
    });

    const first = makeRes();
    await listVideos(makeReq({ pageSize: "20" }), first);
    expect(first.body.items).toHaveLength(20);
    expect(first.body.items[0].videoId).toBe("v0");
    expect(first.body.items[19].videoId).toBe("v19");
    expect(first.body.hasMore).toBe(true);
    expect(first.body.nextCursor).toBeTruthy();

    const second = makeRes();
    await listVideos(makeReq({ pageSize: "20", cursor: first.body.nextCursor }), second);
    expect(second.body.items).toHaveLength(20);
    expect(second.body.items[0].videoId).toBe("v20");
    expect(second.body.items[19].videoId).toBe("v39");

    const third = makeRes();
    await listVideos(makeReq({ pageSize: "20", cursor: second.body.nextCursor }), third);
    expect(third.body.items.map((item) => item.videoId)).toEqual(["v40", "v41", "v42", "v43", "v44"]);
    expect(third.body.hasMore).toBe(false);

    const allIds = [...first.body.items, ...second.body.items, ...third.body.items].map((item) => item.videoId);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("bounds invalid and oversized page requests", async () => {
    fakeDb = makeDb({
      videos: Array.from({ length: 60 }, (_, index) => makeVideo(`v${index}`, 1000 - index)),
    });

    const invalid = makeRes();
    await listVideos(makeReq({ pageSize: "not-a-number" }), invalid);
    expect(invalid.statusCode).toBe(400);

    const oversized = makeRes();
    await listVideos(makeReq({ pageSize: "500" }), oversized);
    expect(oversized.body.pageSize).toBe(50);
    expect(oversized.body.items).toHaveLength(50);
  });

  it("rejects invalid cursors", async () => {
    fakeDb = makeDb({ videos: [makeVideo("a", 100)] });
    const res = makeRes();
    await listVideos(makeReq({ cursor: "not-a-valid-cursor" }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/cursor/i);
  });

  it("excludes non-home, deleted, processing-failed, and merchant-product videos", async () => {
    fakeDb = makeDb({
      videos: [
        makeVideo("home", 100),
        makeVideo("meet", 99, { feedKind: "meet_up", feedEligible: false }),
        makeVideo("deleted", 98, { feedKind: "home", feedEligible: false, status: "DELETED" }),
        makeVideo("failed", 97, { feedKind: "home", feedEligible: false, processingStatus: "processing_failed" }),
        makeVideo("market-domain", 95, { contentDomain: "marketplace", feedKind: "home", feedEligible: true }),
        makeVideo("merchant", 96, { objectPath: "videos/same.mp4" }),
      ],
      merchantProducts: [{ objectPath: "videos/same.mp4" }],
    });
    const res = makeRes();
    await listVideos(makeReq({ pageSize: "20" }), res);
    expect(res.body.items.map((item) => item.videoId)).toEqual(["home"]);
  });

  it("keeps merchant images and videos out of Citizen Home even for the same user", async () => {
    fakeDb = makeDb({
      videos: [
        makeVideo("citizen-same-user", 200, { uid: "same-user" }),
        makeVideo("merchant-video-same-user", 199, {
          uid: "same-user",
          contentDomain: "marketplace",
          uploadPurpose: "merchant_product",
          visibility: "marketplace",
          streamUrl: "https://cdn.example/product-video.mp4",
          feedKind: "home",
          feedEligible: true,
        }),
        makeVideo("merchant-image-like-record", 198, {
          uid: "same-user",
          contentDomain: "marketplace",
          uploadPurpose: "merchant_product",
          visibility: "marketplace",
          streamUrl: "https://cdn.example/product-image.jpg",
          feedKind: "home",
          feedEligible: true,
        }),
      ],
    });
    const res = makeRes();
    await listVideos(makeReq({ pageSize: "20" }), res);
    expect(res.body.items.map((item) => item.videoId)).toEqual(["citizen-same-user"]);
  });

  it("excludes non-ready processing records even when they already have media URLs", async () => {
    fakeDb = makeDb({
      videos: [makeVideo("processing", 100, { status: "processing", processingStatus: "queued", lifecycleStatus: "UPLOADED", feedEligible: false })],
    });
    const res = makeRes();
    await listVideos(makeReq({ pageSize: "20" }), res);
    expect(res.body.items.map((item) => item.videoId)).toEqual([]);
  });

  it("keeps a legacy array response mode for existing clients", async () => {
    fakeDb = makeDb({ videos: [makeVideo("legacy", 100)] });
    const res = makeRes();
    await listVideos(makeReq({ format: "legacy" }), res);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].videoId).toBe("legacy");
    expect(res.headers["x-paragon-has-more"]).toBe("false");
  });
});
