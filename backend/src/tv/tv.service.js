import admin from "../config/firebase.js";
import { isTvChannelState, isTvProgramState } from "./tvStates.js";

export const TV_COLLECTIONS = Object.freeze({
  channels: "tv_channels",
  programs: "tv_programs",
  publicSchedule: "public_tv_schedule",
});

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function cleanText(value, { required = false, max = 500 } = {}) {
  const text = String(value || "").trim();
  if (required && !text) throw Object.assign(new Error("Required text is missing"), { status: 400 });
  if (text.length > max) throw Object.assign(new Error(`Text exceeds ${max} characters`), { status: 400 });
  return text;
}

function safeId(value, label) {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(id)) {
    throw Object.assign(new Error(`${label} is invalid`), { status: 400 });
  }
  return id;
}

function timestampMillis(value) {
  if (value?.toMillis) return value.toMillis();
  const millis = Date.parse(String(value || ""));
  return Number.isFinite(millis) ? millis : 0;
}

function asDate(value, label) {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  if (!Number.isFinite(date.getTime())) throw Object.assign(new Error(`${label} is invalid`), { status: 400 });
  return date;
}

function pageSize(value) {
  if (value == null || value === "") return DEFAULT_PAGE_SIZE;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw Object.assign(new Error("pageSize must be a positive integer"), { status: 400 });
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") throw new Error("invalid");
    return parsed;
  } catch {
    throw Object.assign(new Error("cursor is invalid"), { status: 400 });
  }
}

function serializeDoc(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || null,
    startsAt: data.startsAt?.toDate?.()?.toISOString?.() || data.startsAt || null,
    endsAt: data.endsAt?.toDate?.()?.toISOString?.() || data.endsAt || null,
  };
}

function validatePlaybackReference({ playbackUrl = "", mediaAssetId = "" } = {}, required = false) {
  const url = cleanText(playbackUrl, { max: 2048 });
  const assetId = cleanText(mediaAssetId, { max: 256 });
  if (url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw Object.assign(new Error("playbackUrl is invalid"), { status: 400 }); }
    if (parsed.protocol !== "https:") throw Object.assign(new Error("playbackUrl must use HTTPS"), { status: 400 });
  }
  if (required && !url && !assetId) throw Object.assign(new Error("A playbackUrl or mediaAssetId is required before scheduling"), { status: 400 });
  return { playbackUrl: url, mediaAssetId: assetId };
}

export function channelInput(body = {}, current = {}) {
  const requestedState = String(body.status ?? current.status ?? "DRAFT").toUpperCase();
  if (!isTvChannelState(requestedState)) throw Object.assign(new Error("Channel status is invalid"), { status: 400 });
  return {
    name: cleanText(body.name ?? current.name, { required: true, max: 120 }),
    description: cleanText(body.description ?? current.description, { max: 1000 }),
    logoUrl: cleanText(body.logoUrl ?? current.logoUrl, { max: 2048 }),
    status: requestedState,
    sortOrder: Math.max(0, Math.min(Number(body.sortOrder ?? current.sortOrder ?? 0) || 0, 1_000_000)),
  };
}

export function programInput(body = {}, current = {}) {
  const requestedState = String(body.status ?? current.status ?? "DRAFT").toUpperCase();
  if (!isTvProgramState(requestedState)) throw Object.assign(new Error("Program status is invalid"), { status: 400 });
  return {
    channelId: safeId(body.channelId ?? current.channelId, "channelId"),
    title: cleanText(body.title ?? current.title, { required: true, max: 160 }),
    synopsis: cleanText(body.synopsis ?? current.synopsis, { max: 2000 }),
    status: requestedState,
    ...validatePlaybackReference({
      playbackUrl: body.playbackUrl ?? current.playbackUrl,
      mediaAssetId: body.mediaAssetId ?? current.mediaAssetId,
    }),
  };
}

export async function createChannel({ db, body, actorUid }) {
  const collection = db.collection(TV_COLLECTIONS.channels);
  const ref = body.channelId ? collection.doc(safeId(body.channelId, "channelId")) : collection.doc();
  const existing = await ref.get();
  if (existing.exists) throw Object.assign(new Error("Channel already exists"), { status: 409 });
  const data = channelInput({ ...body, status: "DRAFT" });
  await ref.set({ ...data, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: actorUid, updatedBy: actorUid });
  return { id: ref.id, ...data };
}

export async function updateChannel({ db, channelId, body, actorUid }) {
  const ref = db.collection(TV_COLLECTIONS.channels).doc(safeId(channelId, "channelId"));
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Channel not found"), { status: 404 });
  const data = channelInput({ ...body, status: snap.data().status }, snap.data());
  await ref.set({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actorUid }, { merge: true });
  return { id: ref.id, ...data };
}

export async function setChannelStatus({ db, channelId, status, actorUid }) {
  const normalized = String(status || "").toUpperCase();
  if (!["ACTIVE", "INACTIVE"].includes(normalized)) throw Object.assign(new Error("Channel status is invalid"), { status: 400 });
  const ref = db.collection(TV_COLLECTIONS.channels).doc(safeId(channelId, "channelId"));
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Channel not found"), { status: 404 });
  await ref.set({ status: normalized, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actorUid }, { merge: true });
  return { id: ref.id, ...snap.data(), status: normalized };
}

export async function createProgram({ db, body, actorUid }) {
  const collection = db.collection(TV_COLLECTIONS.programs);
  const ref = body.programId ? collection.doc(safeId(body.programId, "programId")) : collection.doc();
  const existing = await ref.get();
  if (existing.exists) throw Object.assign(new Error("Program already exists"), { status: 409 });
  const data = programInput({ ...body, status: "DRAFT" });
  const channel = await db.collection(TV_COLLECTIONS.channels).doc(data.channelId).get();
  if (!channel.exists) throw Object.assign(new Error("Channel not found"), { status: 404 });
  await ref.set({ ...data, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: actorUid, updatedBy: actorUid });
  return { id: ref.id, ...data };
}

export async function updateProgram({ db, programId, body, actorUid }) {
  const ref = db.collection(TV_COLLECTIONS.programs).doc(safeId(programId, "programId"));
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Program not found"), { status: 404 });
  const current = snap.data() || {};
  const data = programInput({ ...body, status: current.status }, current);
  await ref.set({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actorUid }, { merge: true });
  if (["SCHEDULED", "LIVE", "ENDED"].includes(current.status)) {
    const publicRef = db.collection(TV_COLLECTIONS.publicSchedule).doc(ref.id);
    const publicSnap = await publicRef.get();
    if (publicSnap.exists) {
      await publicRef.set({
        title: data.title,
        synopsis: data.synopsis,
        playbackUrl: data.playbackUrl,
        mediaAssetId: data.mediaAssetId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }
  return { id: ref.id, ...data };
}

export async function scheduleProgram({ db, programId, startsAt, endsAt, actorUid }) {
  const safeProgramId = safeId(programId, "programId");
  const start = asDate(startsAt, "startsAt");
  const end = asDate(endsAt, "endsAt");
  if (end <= start) throw Object.assign(new Error("endsAt must be after startsAt"), { status: 400 });
  const programRef = db.collection(TV_COLLECTIONS.programs).doc(safeProgramId);
  const publicRef = db.collection(TV_COLLECTIONS.publicSchedule).doc(safeProgramId);
  await db.runTransaction(async (transaction) => {
    const programSnap = await transaction.get(programRef);
    if (!programSnap.exists) throw Object.assign(new Error("Program not found"), { status: 404 });
    const current = programSnap.data() || {};
    if (current.status === "CANCELLED") throw Object.assign(new Error("Cancelled programs cannot be scheduled"), { status: 409 });
    const channelRef = db.collection(TV_COLLECTIONS.channels).doc(current.channelId);
    const channelSnap = await transaction.get(channelRef);
    if (!channelSnap.exists || channelSnap.data()?.status !== "ACTIVE") {
      throw Object.assign(new Error("Channel must be ACTIVE before scheduling"), { status: 409 });
    }
    const playback = validatePlaybackReference(current, true);
    const patch = { status: "SCHEDULED", startsAt: start, endsAt: end, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actorUid };
    transaction.set(programRef, patch, { merge: true });
    transaction.set(publicRef, {
      programId: safeProgramId,
      channelId: current.channelId,
      title: current.title,
      synopsis: current.synopsis || "",
      status: "SCHEDULED",
      startsAt: start,
      endsAt: end,
      ...playback,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });
  });
  return { id: safeProgramId, status: "SCHEDULED", startsAt: start.toISOString(), endsAt: end.toISOString() };
}

export async function listChannels({ db, requestedPageSize, cursor }) {
  const size = pageSize(requestedPageSize);
  const decoded = decodeCursor(cursor);
  let query = db.collection(TV_COLLECTIONS.channels)
    .where("status", "==", "ACTIVE")
    .orderBy("name", "asc")
    .orderBy(admin.firestore.FieldPath.documentId(), "asc")
    .limit(size + 1);
  if (decoded) {
    if (!decoded.name || !decoded.id) throw Object.assign(new Error("cursor is invalid"), { status: 400 });
    query = query.startAfter(decoded.name, decoded.id);
  }
  const snap = await query.get();
  const hasMore = snap.docs.length > size;
  const docs = snap.docs.slice(0, size);
  const last = docs.at(-1);
  return { items: docs.map(serializeDoc), hasMore, nextCursor: hasMore && last ? encodeCursor({ name: last.data().name, id: last.id }) : null };
}

export async function getChannel({ db, channelId }) {
  const snap = await db.collection(TV_COLLECTIONS.channels).doc(safeId(channelId, "channelId")).get();
  if (!snap.exists || snap.data()?.status !== "ACTIVE") throw Object.assign(new Error("Channel not found"), { status: 404 });
  return serializeDoc(snap);
}

export async function adminListChannels({ db, requestedPageSize, cursor }) {
  const size = pageSize(requestedPageSize);
  const decoded = decodeCursor(cursor);
  let query = db.collection(TV_COLLECTIONS.channels)
    .orderBy("name", "asc")
    .orderBy(admin.firestore.FieldPath.documentId(), "asc")
    .limit(size + 1);
  if (decoded) {
    if (!decoded.name || !decoded.id) throw Object.assign(new Error("cursor is invalid"), { status: 400 });
    query = query.startAfter(decoded.name, decoded.id);
  }
  const snap = await query.get();
  const hasMore = snap.docs.length > size;
  const docs = snap.docs.slice(0, size);
  const last = docs.at(-1);
  return {
    items: docs.map(serializeDoc),
    hasMore,
    nextCursor: hasMore && last ? encodeCursor({ name: last.data().name, id: last.id }) : null,
  };
}

export async function adminGetChannel({ db, channelId }) {
  const snap = await db.collection(TV_COLLECTIONS.channels).doc(safeId(channelId, "channelId")).get();
  if (!snap.exists) throw Object.assign(new Error("Channel not found"), { status: 404 });
  return serializeDoc(snap);
}

export async function adminListPrograms({ db, requestedPageSize, cursor, channelId = "", status = "" }) {
  const size = pageSize(requestedPageSize);
  const decoded = decodeCursor(cursor);
  const safeChannelId = channelId ? safeId(channelId, "channelId") : "";
  const safeStatus = status ? String(status).toUpperCase() : "";
  if (safeStatus && !isTvProgramState(safeStatus)) throw Object.assign(new Error("Program status is invalid"), { status: 400 });
  let query = db.collection(TV_COLLECTIONS.programs);
  if (safeChannelId) query = query.where("channelId", "==", safeChannelId);
  if (safeStatus) query = query.where("status", "==", safeStatus);
  query = query
    .orderBy("createdAt", "desc")
    .orderBy(admin.firestore.FieldPath.documentId(), "desc")
    .limit(size + 1);
  if (decoded) {
    const millis = Number(decoded.createdAtMillis);
    if (!Number.isFinite(millis) || !decoded.id) throw Object.assign(new Error("cursor is invalid"), { status: 400 });
    query = query.startAfter(admin.firestore.Timestamp.fromMillis(millis), decoded.id);
  }
  const snap = await query.get();
  const hasMore = snap.docs.length > size;
  const docs = snap.docs.slice(0, size);
  const last = docs.at(-1);
  return {
    items: docs.map(serializeDoc),
    hasMore,
    nextCursor: hasMore && last ? encodeCursor({ createdAtMillis: timestampMillis(last.data().createdAt), id: last.id }) : null,
  };
}

export async function adminGetProgram({ db, programId }) {
  const snap = await db.collection(TV_COLLECTIONS.programs).doc(safeId(programId, "programId")).get();
  if (!snap.exists) throw Object.assign(new Error("Program not found"), { status: 404 });
  return serializeDoc(snap);
}

export async function getCurrentProgram({ db, channelId, now = new Date() }) {
  const id = safeId(channelId, "channelId");
  const snap = await db.collection(TV_COLLECTIONS.publicSchedule)
    .where("channelId", "==", id)
    .where("startsAt", "<=", now)
    .orderBy("startsAt", "desc")
    .limit(5)
    .get();
  const current = snap.docs.find((doc) => timestampMillis(doc.data().endsAt) > now.getTime() && doc.data().status !== "CANCELLED");
  return current ? serializeDoc(current) : null;
}

export async function getNextProgram({ db, channelId, now = new Date() }) {
  const snap = await db.collection(TV_COLLECTIONS.publicSchedule)
    .where("channelId", "==", safeId(channelId, "channelId"))
    .where("startsAt", ">", now)
    .orderBy("startsAt", "asc")
    .limit(1)
    .get();
  return snap.docs[0] ? serializeDoc(snap.docs[0]) : null;
}

export async function listSchedule({ db, channelId, requestedPageSize, cursor }) {
  const size = pageSize(requestedPageSize);
  const decoded = decodeCursor(cursor);
  let query = db.collection(TV_COLLECTIONS.publicSchedule)
    .where("channelId", "==", safeId(channelId, "channelId"))
    .orderBy("startsAt", "asc")
    .orderBy(admin.firestore.FieldPath.documentId(), "asc")
    .limit(size + 1);
  if (decoded) {
    const millis = Number(decoded.startsAtMillis);
    if (!Number.isFinite(millis) || !decoded.id) throw Object.assign(new Error("cursor is invalid"), { status: 400 });
    query = query.startAfter(admin.firestore.Timestamp.fromMillis(millis), decoded.id);
  }
  const snap = await query.get();
  const hasMore = snap.docs.length > size;
  const docs = snap.docs.slice(0, size);
  const last = docs.at(-1);
  return {
    items: docs.map(serializeDoc),
    hasMore,
    nextCursor: hasMore && last ? encodeCursor({ startsAtMillis: timestampMillis(last.data().startsAt), id: last.id }) : null,
  };
}
