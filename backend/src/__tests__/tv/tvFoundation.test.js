import { beforeEach, describe, expect, it, vi } from "vitest";

let fakeDb;

vi.mock("../../config/firebase.js", () => ({
  default: {
    firestore: Object.assign(() => fakeDb, {
      FieldPath: { documentId: () => "__name__" },
      FieldValue: { serverTimestamp: () => ({ serverTimestamp: true }) },
      Timestamp: { fromMillis: (millis) => stamp(millis) },
    }),
  },
}));

const {
  TV_COLLECTIONS,
  adminGetChannel,
  adminGetProgram,
  adminListChannels,
  adminListPrograms,
  createChannel,
  createProgram,
  getCurrentProgram,
  getNextProgram,
  listChannels,
  listSchedule,
  scheduleProgram,
  setChannelStatus,
  updateProgram,
} = await import("../../tv/tv.service.js");
const { TV_CHANNEL_STATES, TV_PROGRAM_STATES } = await import("../../tv/tvStates.js");
const { default: tvRouter } = await import("../../routes/tv/tv.routes.js");
const { requireAdmin } = await import("../../middlewares/admin.middleware.js");

function stamp(value) {
  const millis = value instanceof Date ? value.getTime() : Number(value);
  return { toMillis: () => millis, toDate: () => new Date(millis) };
}

function compare(a, b) {
  const av = a?.toMillis?.() ?? a;
  const bv = b?.toMillis?.() ?? b;
  return av < bv ? -1 : av > bv ? 1 : 0;
}

class FakeDocRef {
  constructor(db, collection, id) { this.db = db; this.collection = collection; this.id = id; }
  async get() { return this.db.snapshot(this.collection, this.id); }
  async set(data, options = {}) { this.db.write(this.collection, this.id, data, options); }
}

class FakeQuery {
  constructor(db, collection) { this.db = db; this.collection = collection; this.filters = []; this.orders = []; this.after = null; this.max = Infinity; }
  where(field, op, value) { this.filters.push({ field, op, value }); return this; }
  orderBy(field, direction = "asc") { this.orders.push({ field, direction }); return this; }
  startAfter(...values) { this.after = values; return this; }
  limit(value) { this.max = value; this.db.queryLimits.push(value); return this; }
  async get() {
    let rows = [...(this.db.data[this.collection]?.entries() || [])].map(([id, data]) => ({ id, data }));
    for (const filter of this.filters) {
      rows = rows.filter((row) => {
        const value = filter.field === "__name__" ? row.id : row.data[filter.field];
        if (filter.op === "==") return value === filter.value;
        if (filter.op === "<=") return compare(value, filter.value) <= 0;
        if (filter.op === ">") return compare(value, filter.value) > 0;
        return false;
      });
    }
    rows.sort((left, right) => {
      for (const order of this.orders) {
        const a = order.field === "__name__" ? left.id : left.data[order.field];
        const b = order.field === "__name__" ? right.id : right.data[order.field];
        const result = compare(a, b);
        if (result) return order.direction === "desc" ? -result : result;
      }
      return 0;
    });
    if (this.after) {
      const index = rows.findIndex((row) => this.orders.every((order, i) => compare(order.field === "__name__" ? row.id : row.data[order.field], this.after[i]) === 0));
      if (index >= 0) rows = rows.slice(index + 1);
    }
    const docs = rows.slice(0, this.max).map((row) => this.db.snapshot(this.collection, row.id));
    return { empty: docs.length === 0, docs };
  }
}

function makeDb(seed = {}) {
  let generated = 0;
  const db = {
    data: Object.fromEntries(Object.entries(seed).map(([name, docs]) => [name, new Map(Object.entries(docs))])),
    touched: [],
    queryLimits: [],
    collection(name) {
      db.data[name] ||= new Map();
      return {
        doc(id = `generated-${++generated}`) { return new FakeDocRef(db, name, id); },
        where(...args) { return new FakeQuery(db, name).where(...args); },
        orderBy(...args) { return new FakeQuery(db, name).orderBy(...args); },
      };
    },
    snapshot(collection, id) {
      const value = db.data[collection]?.get(id);
      return { id, exists: Boolean(value), ref: new FakeDocRef(db, collection, id), data: () => value || {} };
    },
    write(collection, id, value, options = {}) {
      db.touched.push(collection);
      const current = db.data[collection]?.get(id) || {};
      db.data[collection].set(id, options.merge ? { ...current, ...value } : value);
    },
    async runTransaction(callback) {
      return callback({
        get: (ref) => ref.get(),
        set: (ref, value, options) => db.write(ref.collection, ref.id, value, options),
      });
    },
  };
  return db;
}

describe("Paragon TV Milestone 1A", () => {
  beforeEach(() => { fakeDb = makeDb(); });

  it("defines only the approved minimal lifecycle states", () => {
    expect(TV_CHANNEL_STATES).toEqual(["DRAFT", "ACTIVE", "INACTIVE"]);
    expect(TV_PROGRAM_STATES).toEqual(["DRAFT", "SCHEDULED", "LIVE", "ENDED", "CANCELLED"]);
  });

  it("exposes public reads and protects every Admin write with authentication and Admin authorization", () => {
    const routes = tvRouter.stack.filter((layer) => layer.route).map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
      handlers: layer.route.stack.map((entry) => entry.handle.name),
    }));
    expect(routes.filter((route) => route.path.startsWith("/admin/"))).toHaveLength(11);
    for (const route of routes.filter((entry) => entry.path.startsWith("/admin/"))) {
      expect(route.handlers).toContain("authenticate");
      expect(route.handlers).toContain("requireAdmin");
    }
    expect(routes.find((route) => route.path === "/channels")).toMatchObject({ methods: ["get"] });
    expect(routes.find((route) => route.path === "/channels/:channelId/schedule")).toMatchObject({ methods: ["get"] });
  });

  it("denies a non-Admin before an Admin read handler runs", () => {
    const response = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    const next = vi.fn();
    requireAdmin({ user: { uid: "ordinary-user" } }, response, next);
    expect(response.statusCode).toBe(403);
    expect(response.body.error).toMatch(/Admin permission required/i);
    expect(next).not.toHaveBeenCalled();
  });

  it("lists every channel state for Admins with stable cursor pagination", async () => {
    fakeDb = makeDb({ tv_channels: {
      active: { name: "Alpha", status: "ACTIVE" },
      draft: { name: "Beta", status: "DRAFT" },
      inactive: { name: "Gamma", status: "INACTIVE" },
    } });
    const first = await adminListChannels({ db: fakeDb, requestedPageSize: 2 });
    const second = await adminListChannels({ db: fakeDb, requestedPageSize: 2, cursor: first.nextCursor });
    expect(first.items.map((item) => item.status)).toEqual(["ACTIVE", "DRAFT"]);
    expect(second.items.map((item) => item.status)).toEqual(["INACTIVE"]);
    expect(fakeDb.queryLimits).toEqual([3, 3]);
  });

  it("retrieves Admin channel detail regardless of state and returns a 404 for missing IDs", async () => {
    fakeDb = makeDb({ tv_channels: { draft: { name: "Draft", status: "DRAFT" } } });
    expect(await adminGetChannel({ db: fakeDb, channelId: "draft" })).toMatchObject({ id: "draft", status: "DRAFT" });
    await expect(adminGetChannel({ db: fakeDb, channelId: "missing" })).rejects.toMatchObject({ status: 404 });
  });

  it("lists programs with channel, status, and combined filters", async () => {
    fakeDb = makeDb({ tv_programs: {
      a: { channelId: "channel-one", title: "A", status: "DRAFT", createdAt: stamp(400) },
      b: { channelId: "channel-one", title: "B", status: "SCHEDULED", createdAt: stamp(300) },
      c: { channelId: "channel-two", title: "C", status: "DRAFT", createdAt: stamp(200) },
      d: { channelId: "channel-two", title: "D", status: "ENDED", createdAt: stamp(100) },
    } });
    expect((await adminListPrograms({ db: fakeDb })).items).toHaveLength(4);
    expect((await adminListPrograms({ db: fakeDb, channelId: "channel-one" })).items.map((item) => item.id)).toEqual(["a", "b"]);
    expect((await adminListPrograms({ db: fakeDb, status: "DRAFT" })).items.map((item) => item.id)).toEqual(["a", "c"]);
    expect((await adminListPrograms({ db: fakeDb, channelId: "channel-one", status: "DRAFT" })).items.map((item) => item.id)).toEqual(["a"]);
  });

  it("cursor-paginates programs deterministically and caps oversized reads", async () => {
    const programs = {};
    for (let index = 0; index < 55; index += 1) {
      programs[`program-${String(index).padStart(2, "0")}`] = { channelId: "channel-one", title: `Program ${index}`, status: "DRAFT", createdAt: stamp(1_000 - index) };
    }
    fakeDb = makeDb({ tv_programs: programs });
    const first = await adminListPrograms({ db: fakeDb, requestedPageSize: 500 });
    const second = await adminListPrograms({ db: fakeDb, requestedPageSize: 50, cursor: first.nextCursor });
    expect(first.items).toHaveLength(50);
    expect(first.hasMore).toBe(true);
    expect(second.items).toHaveLength(5);
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(55);
    expect(fakeDb.queryLimits).toEqual([51, 51]);
  });

  it("retrieves Admin program detail regardless of state and returns a 404 for missing IDs", async () => {
    fakeDb = makeDb({ tv_programs: { ended: { channelId: "channel-one", title: "Ended", status: "ENDED", createdAt: stamp(1) } } });
    expect(await adminGetProgram({ db: fakeDb, programId: "ended" })).toMatchObject({ id: "ended", status: "ENDED" });
    await expect(adminGetProgram({ db: fakeDb, programId: "missing" })).rejects.toMatchObject({ status: 404 });
  });

  it("creates and activates a channel without touching Live collections", async () => {
    const channel = await createChannel({ db: fakeDb, actorUid: "admin-1", body: { channelId: "news-one", name: "News One" } });
    expect(channel).toMatchObject({ id: "news-one", status: "DRAFT" });
    await setChannelStatus({ db: fakeDb, channelId: "news-one", status: "ACTIVE", actorUid: "admin-1" });
    expect(fakeDb.data.tv_channels.get("news-one").status).toBe("ACTIVE");
    expect(fakeDb.touched.every((name) => Object.values(TV_COLLECTIONS).includes(name))).toBe(true);
    expect(fakeDb.touched.some((name) => name.includes("live"))).toBe(false);
  });

  it("creates and schedules a program with a public projection idempotently", async () => {
    fakeDb = makeDb({ tv_channels: { "news-one": { name: "News One", status: "ACTIVE" } } });
    await createProgram({ db: fakeDb, actorUid: "admin-1", body: { programId: "evening-news", channelId: "news-one", title: "Evening News", playbackUrl: "https://media.example/news.m3u8" } });
    const start = "2026-10-01T18:00:00Z";
    const end = "2026-10-01T19:00:00Z";
    await scheduleProgram({ db: fakeDb, programId: "evening-news", startsAt: start, endsAt: end, actorUid: "admin-1" });
    await scheduleProgram({ db: fakeDb, programId: "evening-news", startsAt: start, endsAt: end, actorUid: "admin-1" });
    expect(fakeDb.data.tv_programs.get("evening-news").status).toBe("SCHEDULED");
    expect(fakeDb.data.public_tv_schedule.size).toBe(1);
    expect(fakeDb.data.public_tv_schedule.get("evening-news")).toMatchObject({ channelId: "news-one", playbackUrl: "https://media.example/news.m3u8" });
    expect(fakeDb.touched.some((name) => name.includes("live"))).toBe(false);
  });

  it("requires an approved HTTPS playback reference before scheduling", async () => {
    fakeDb = makeDb({
      tv_channels: { "news-one": { name: "News One", status: "ACTIVE" } },
      tv_programs: { draft: { channelId: "news-one", title: "Draft", status: "DRAFT" } },
    });
    await expect(scheduleProgram({ db: fakeDb, programId: "draft", startsAt: "2026-10-01T18:00:00Z", endsAt: "2026-10-01T19:00:00Z", actorUid: "admin-1" })).rejects.toThrow(/playbackUrl or mediaAssetId/i);
  });

  it("keeps an already scheduled public projection synchronized when a program is edited", async () => {
    fakeDb = makeDb({
      tv_programs: { news: { channelId: "news-one", title: "Old title", synopsis: "", status: "SCHEDULED", playbackUrl: "https://media.example/old.m3u8", mediaAssetId: "" } },
      public_tv_schedule: { news: { channelId: "news-one", title: "Old title", status: "SCHEDULED", startsAt: stamp(1), endsAt: stamp(2) } },
    });
    await updateProgram({ db: fakeDb, programId: "news", body: { title: "New title" }, actorUid: "admin-1" });
    expect(fakeDb.data.public_tv_schedule.get("news").title).toBe("New title");
    expect(fakeDb.touched.some((name) => name.includes("live"))).toBe(false);
  });

  it("returns only ACTIVE channels with a bounded cursor", async () => {
    fakeDb = makeDb({ tv_channels: {
      alpha: { name: "Alpha", status: "ACTIVE" },
      beta: { name: "Beta", status: "ACTIVE" },
      draft: { name: "Draft", status: "DRAFT" },
    } });
    const first = await listChannels({ db: fakeDb, requestedPageSize: 1 });
    const second = await listChannels({ db: fakeDb, requestedPageSize: 1, cursor: first.nextCursor });
    expect(first.items.map((item) => item.id)).toEqual(["alpha"]);
    expect(first.hasMore).toBe(true);
    expect(second.items.map((item) => item.id)).toEqual(["beta"]);
    expect(second.hasMore).toBe(false);
  });

  it("returns current, next, and cursor-paginated schedules from public_tv_schedule", async () => {
    const base = Date.parse("2026-10-01T12:00:00Z");
    fakeDb = makeDb({ public_tv_schedule: {
      current: { channelId: "news-one", title: "Current", status: "SCHEDULED", startsAt: stamp(base - 1_000), endsAt: stamp(base + 1_000) },
      next: { channelId: "news-one", title: "Next", status: "SCHEDULED", startsAt: stamp(base + 2_000), endsAt: stamp(base + 3_000) },
      later: { channelId: "news-one", title: "Later", status: "SCHEDULED", startsAt: stamp(base + 4_000), endsAt: stamp(base + 5_000) },
    } });
    expect((await getCurrentProgram({ db: fakeDb, channelId: "news-one", now: new Date(base) })).id).toBe("current");
    expect((await getNextProgram({ db: fakeDb, channelId: "news-one", now: new Date(base) })).id).toBe("next");
    const first = await listSchedule({ db: fakeDb, channelId: "news-one", requestedPageSize: 2 });
    const second = await listSchedule({ db: fakeDb, channelId: "news-one", requestedPageSize: 2, cursor: first.nextCursor });
    expect(first.items.map((item) => item.id)).toEqual(["current", "next"]);
    expect(second.items.map((item) => item.id)).toEqual(["later"]);
  });
});
