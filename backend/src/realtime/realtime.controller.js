import admin from "../config/firebase.js";
import { CALL_STATUSES, TERMINAL_STATUSES, callExpiresAt, getCallPlan, listCallPlans } from "./callPlans.js";
import { createParticipantToken, createRealtimeRoom, realtimeProviderStatus } from "./cloudflareRealtime.js";
import { measureAsync, measureFirestore } from "../observability/perf.js";

const REQUEST_EXPIRY_MS = 90 * 1000;

function nowField() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function assertAuth(req) {
  const uid = req.user?.uid;
  if (!uid) {
    const error = new Error("Login first");
    error.status = 401;
    throw error;
  }
  return uid;
}

function firstText(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "Paragon Member";
}

async function profileName(db, uid, fallback = "Paragon Member") {
  const snap = await db.collection("public_profiles").doc(uid).get();
  const data = snap.data() || {};
  return firstText(data.displayName, data.stageName, data.realName, data.name, data.brandName, data.email, fallback);
}

function callCollection(db) {
  return db.collection("realtime_call_sessions");
}

function historyCollection(db) {
  return db.collection("realtime_call_history");
}

async function releaseReservation(db, callId, nextStatus, actorId, reason) {
  const callRef = callCollection(db).doc(callId);
  await measureAsync({
    event: "firestore.transaction",
    domain: "realtime",
    operation: `release-reservation-${nextStatus}`,
  }, () => db.runTransaction(async (transaction) => {
    const callSnap = await transaction.get(callRef);
    if (!callSnap.exists) throw Object.assign(new Error("Call not found"), { status: 404 });
    const call = callSnap.data() || {};
    if (call.reservationReleased || call.chargeFinalized) return;
    if (!call.requesterId || !call.priceParag) throw Object.assign(new Error("Invalid reservation"), { status: 409 });

    const walletRef = db.collection("wallet_accounts").doc(call.requesterId);
    transaction.set(walletRef, {
      balances: { parag: admin.firestore.FieldValue.increment(Number(call.priceParag || 0)) },
      lockedBalances: { parag: admin.firestore.FieldValue.increment(-Number(call.priceParag || 0)) },
      updatedAt: nowField(),
    }, { merge: true });

    transaction.set(db.collection("ledger_entries").doc(), {
      accountId: call.requesterId,
      direction: "credit",
      amount: Number(call.priceParag || 0),
      amountParag: Number(call.priceParag || 0),
      currency: "PARAG",
      reason: `Video call reservation released: ${reason}`,
      callId,
      createdAt: nowField(),
    });

    transaction.set(callRef, {
      status: nextStatus,
      reservationReleased: true,
      releasedAt: nowField(),
      releasedBy: actorId || "system",
      releaseReason: reason,
      updatedAt: nowField(),
    }, { merge: true });
  }));
}

async function finalizeChargeIfReady(db, callId) {
  const callRef = callCollection(db).doc(callId);
  await measureAsync({
    event: "firestore.transaction",
    domain: "realtime",
    operation: "finalize-call-charge",
  }, () => db.runTransaction(async (transaction) => {
    const callSnap = await transaction.get(callRef);
    if (!callSnap.exists) throw Object.assign(new Error("Call not found"), { status: 404 });
    const call = callSnap.data() || {};
    if (call.chargeFinalized || call.reservationReleased) return;
    const connected = call.connectedParticipants || {};
    if (!connected[call.requesterId] || !connected[call.recipientId]) return;

    const requesterWalletRef = db.collection("wallet_accounts").doc(call.requesterId);
    const recipientWalletRef = db.collection("wallet_accounts").doc(call.recipientId);
    const price = Number(call.priceParag || 0);
    const platformShare = Number(call.platformShareParag || price);
    const recipientShare = Number(call.recipientShareParag || 0);

    transaction.set(requesterWalletRef, {
      lockedBalances: { parag: admin.firestore.FieldValue.increment(-price) },
      updatedAt: nowField(),
    }, { merge: true });

    if (recipientShare > 0) {
      transaction.set(recipientWalletRef, {
        balances: { parag: admin.firestore.FieldValue.increment(recipientShare) },
        updatedAt: nowField(),
      }, { merge: true });
    }

    transaction.set(db.collection("ledger_entries").doc(), {
      accountId: call.requesterId,
      counterpartyId: call.recipientId,
      direction: "debit",
      amount: price,
      amountParag: price,
      currency: "PARAG",
      reason: "Private video call connected",
      callId,
      createdAt: nowField(),
    });

    if (recipientShare > 0) {
      transaction.set(db.collection("ledger_entries").doc(), {
        accountId: call.recipientId,
        counterpartyId: call.requesterId,
        direction: "credit",
        amount: recipientShare,
        amountParag: recipientShare,
        currency: "PARAG",
        reason: "Private video call recipient share",
        callId,
        createdAt: nowField(),
      });
    }

    transaction.set(callRef, {
      status: CALL_STATUSES.CONNECTED,
      chargeFinalized: true,
      connectedAt: nowField(),
      platformShareParag: platformShare,
      recipientShareParag: recipientShare,
      updatedAt: nowField(),
    }, { merge: true });
  }));
}

export async function getRealtimePlans(req, res) {
  try {
    const plans = await measureFirestore({
      domain: "realtime",
      operation: "list-call-plans",
      collection: "realtime_call_plans",
      operationType: "query",
      requestId: req.requestId,
    }, () => listCallPlans());
    return res.json({ plans, provider: realtimeProviderStatus() });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not load call plans" });
  }
}

export async function requestPrivateCall(req, res) {
  try {
    const requesterId = assertAuth(req);
    const { recipientId, planId, idempotencyKey } = req.body || {};
    if (!recipientId || recipientId === requesterId) return res.status(400).json({ error: "Valid recipient is required" });
    if (!idempotencyKey) return res.status(400).json({ error: "idempotencyKey is required" });

    const db = admin.firestore();
    const plan = await getCallPlan(planId, db);
    if (!plan) return res.status(400).json({ error: "Unknown or inactive call plan" });

    const callId = `${requesterId}_${recipientId}_${idempotencyKey}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 320);
    const callRef = callCollection(db).doc(callId);
    const walletRef = db.collection("wallet_accounts").doc(requesterId);
    const [requesterName, recipientName] = await Promise.all([
      profileName(db, requesterId, req.user?.email || "Requester"),
      profileName(db, recipientId, "Recipient"),
    ]);

    await measureAsync({
      event: "firestore.transaction",
      domain: "realtime",
      operation: "request-private-call",
      requestId: req.requestId,
    }, () => db.runTransaction(async (transaction) => {
      const [callSnap, walletSnap] = await Promise.all([transaction.get(callRef), transaction.get(walletRef)]);
      if (callSnap.exists) return;
      const wallet = walletSnap.data() || {};
      const availableParag = Number(wallet.balances?.parag || 0);
      if (availableParag < plan.priceParag) throw Object.assign(new Error("Insufficient PARAG balance."), { status: 400 });

      transaction.set(walletRef, {
        role: "wallet",
        balances: { parag: admin.firestore.FieldValue.increment(-plan.priceParag) },
        lockedBalances: { parag: admin.firestore.FieldValue.increment(plan.priceParag) },
        updatedAt: nowField(),
      }, { merge: true });

      transaction.set(callRef, {
        callId,
        type: "PRIVATE_VIDEO_CALL",
        status: CALL_STATUSES.RINGING,
        requesterId,
        requesterName,
        recipientId,
        recipientName,
        planId: plan.id,
        planLabel: plan.label,
        durationMinutes: plan.durationMinutes,
        priceParag: plan.priceParag,
        grossAmountParag: plan.priceParag,
        platformShareParag: plan.priceParag,
        recipientShareParag: 0,
        participantLimit: 2,
        provider: realtimeProviderStatus().provider,
        providerConfigured: realtimeProviderStatus().configured,
        reservationHeld: true,
        reservationReleased: false,
        chargeFinalized: false,
        connectedParticipants: {},
        expiresAt: callExpiresAt(REQUEST_EXPIRY_MS),
        createdAt: nowField(),
        updatedAt: nowField(),
      });

      transaction.set(db.collection("ledger_entries").doc(), {
        accountId: requesterId,
        counterpartyId: recipientId,
        direction: "hold",
        amount: plan.priceParag,
        amountParag: plan.priceParag,
        currency: "PARAG",
        reason: "Private video call reservation",
        callId,
        createdAt: nowField(),
      });
    }));

    const snap = await callRef.get();
    return res.status(201).json({ call: { id: callId, ...snap.data() } });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not request video call" });
  }
}

export async function listMyCalls(req, res) {
  try {
    const uid = assertAuth(req);
    const db = admin.firestore();
    const [incoming, outgoing] = await Promise.all([
      measureFirestore({
        domain: "realtime",
        operation: "list-incoming-calls",
        collection: "realtime_call_sessions",
        operationType: "query",
        requestId: req.requestId,
      }, () => callCollection(db).where("recipientId", "==", uid).limit(40).get()),
      measureFirestore({
        domain: "realtime",
        operation: "list-outgoing-calls",
        collection: "realtime_call_sessions",
        operationType: "query",
        requestId: req.requestId,
      }, () => callCollection(db).where("requesterId", "==", uid).limit(40).get()),
    ]);
    const calls = [...incoming.docs, ...outgoing.docs]
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => Number(b.createdAt?.toMillis?.() || 0) - Number(a.createdAt?.toMillis?.() || 0));
    return res.json({ calls });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not load calls" });
  }
}

export async function acceptCall(req, res) {
  try {
    const uid = assertAuth(req);
    const db = admin.firestore();
    const callRef = callCollection(db).doc(req.params.callId);
    const snap = await callRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Call not found" });
    const call = snap.data() || {};
    if (call.recipientId !== uid) return res.status(403).json({ error: "Only the recipient can accept this call" });
    if (TERMINAL_STATUSES.has(call.status)) return res.status(409).json({ error: "This call is no longer active" });
    if (call.status === CALL_STATUSES.CONNECTED) return res.json({ call: { id: snap.id, ...call } });

    let room = call.roomId ? { roomId: call.roomId, roomName: call.roomName } : null;
    let providerMessage = "";
    if (!room) {
      try {
        room = await measureAsync({
          event: "realtime.room.create",
          domain: "realtime",
          operation: "create-cloudflare-realtime-room",
          requestId: req.requestId,
        }, () => createRealtimeRoom({
          callId: snap.id,
          durationMinutes: call.durationMinutes,
          participantLimit: call.participantLimit || 2,
        }));
      } catch (error) {
        if (error.status !== 503) throw error;
        providerMessage = "Cloudflare Realtime is not configured yet.";
      }
    }

    await callRef.set({
      status: CALL_STATUSES.ACCEPTED,
      ...(room ? { roomId: room.roomId, roomName: room.roomName } : {}),
      providerPending: !room,
      providerMessage,
      acceptedAt: nowField(),
      updatedAt: nowField(),
    }, { merge: true });
    const updated = await callRef.get();
    return res.json({ call: { id: updated.id, ...updated.data() } });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not accept call" });
  }
}

export async function declineCall(req, res) {
  try {
    const uid = assertAuth(req);
    const db = admin.firestore();
    const snap = await callCollection(db).doc(req.params.callId).get();
    if (!snap.exists) return res.status(404).json({ error: "Call not found" });
    const call = snap.data() || {};
    if (call.recipientId !== uid) return res.status(403).json({ error: "Only the recipient can decline this call" });
    await releaseReservation(db, req.params.callId, CALL_STATUSES.DECLINED, uid, "declined");
    const updated = await callCollection(db).doc(req.params.callId).get();
    return res.json({ call: { id: updated.id, ...updated.data() } });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not decline call" });
  }
}

export async function cancelCall(req, res) {
  try {
    const uid = assertAuth(req);
    const db = admin.firestore();
    const snap = await callCollection(db).doc(req.params.callId).get();
    if (!snap.exists) return res.status(404).json({ error: "Call not found" });
    const call = snap.data() || {};
    if (call.requesterId !== uid) return res.status(403).json({ error: "Only the requester can cancel this call" });
    if (call.status !== CALL_STATUSES.RINGING && call.status !== CALL_STATUSES.ACCEPTED) {
      return res.status(409).json({ error: "This call can no longer be cancelled" });
    }
    await releaseReservation(db, req.params.callId, CALL_STATUSES.CANCELLED, uid, "cancelled");
    const updated = await callCollection(db).doc(req.params.callId).get();
    return res.json({ call: { id: updated.id, ...updated.data() } });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not cancel call" });
  }
}

export async function joinCall(req, res) {
  try {
    const uid = assertAuth(req);
    const db = admin.firestore();
    const callRef = callCollection(db).doc(req.params.callId);
    const snap = await callRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Call not found" });
    const call = snap.data() || {};
    if (![call.requesterId, call.recipientId].includes(uid)) return res.status(403).json({ error: "You are not a participant in this call" });
    if (![CALL_STATUSES.ACCEPTED, CALL_STATUSES.CONNECTING, CALL_STATUSES.CONNECTED].includes(call.status)) {
      return res.status(409).json({ error: "Call is not ready to join" });
    }
    if (!call.roomId) return res.status(409).json({ error: "Realtime room has not been created" });

    const participantName = uid === call.requesterId ? call.requesterName : call.recipientName;
    const token = await measureAsync({
      event: "realtime.token.create",
      domain: "realtime",
      operation: "create-cloudflare-participant-token",
      requestId: req.requestId,
    }, () => createParticipantToken({
      roomId: call.roomId,
      participantId: uid,
      participantName,
      callId: snap.id,
    }));
    await callRef.set({ status: CALL_STATUSES.CONNECTING, updatedAt: nowField() }, { merge: true });
    return res.json({ call: { id: snap.id, ...call, status: CALL_STATUSES.CONNECTING }, token });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not join call" });
  }
}

export async function markConnected(req, res) {
  try {
    const uid = assertAuth(req);
    const db = admin.firestore();
    const callRef = callCollection(db).doc(req.params.callId);
    const snap = await callRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Call not found" });
    const call = snap.data() || {};
    if (![call.requesterId, call.recipientId].includes(uid)) return res.status(403).json({ error: "You are not a participant in this call" });
    await callRef.set({
      [`connectedParticipants.${uid}`]: true,
      [`connectedAtByParticipant.${uid}`]: nowField(),
      updatedAt: nowField(),
    }, { merge: true });
    await finalizeChargeIfReady(db, req.params.callId);
    const updated = await callRef.get();
    return res.json({ call: { id: updated.id, ...updated.data() } });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not mark call connected" });
  }
}

export async function endCall(req, res) {
  try {
    const uid = assertAuth(req);
    const db = admin.firestore();
    const callRef = callCollection(db).doc(req.params.callId);
    const snap = await callRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Call not found" });
    const call = snap.data() || {};
    if (![call.requesterId, call.recipientId].includes(uid)) return res.status(403).json({ error: "You are not a participant in this call" });

    if (!call.chargeFinalized && !call.reservationReleased) {
      await releaseReservation(db, req.params.callId, CALL_STATUSES.FAILED, uid, "ended_before_connection");
    } else {
      await callRef.set({ status: CALL_STATUSES.ENDED, endedAt: nowField(), endedBy: uid, updatedAt: nowField() }, { merge: true });
    }

    const updated = await callRef.get();
    const data = updated.data() || {};
    await historyCollection(db).doc(`${req.params.callId}_${uid}`).set({
      callId: req.params.callId,
      userId: uid,
      direction: uid === data.requesterId ? "outgoing" : "incoming",
      otherUserId: uid === data.requesterId ? data.recipientId : data.requesterId,
      otherUserName: uid === data.requesterId ? data.recipientName : data.requesterName,
      planId: data.planId,
      planLabel: data.planLabel,
      durationMinutes: data.durationMinutes,
      status: data.status,
      connectedAt: data.connectedAt || null,
      endedAt: nowField(),
      createdAt: data.createdAt || nowField(),
      updatedAt: nowField(),
    }, { merge: true });
    return res.json({ call: { id: updated.id, ...data } });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not end call" });
  }
}
