/**
 * AuditService – append-only audit trail for all Marketplace events.
 *
 * Every action (human or automated) is recorded with a timestamp, action
 * name, and actor.  The SYSTEM actor is used for scheduled-job writes.
 *
 * Schema (marketplace_audit_log):
 *   auditId   – UUID
 *   orderId   – merchant_orders document ID
 *   action    – snake_case action name (e.g. "escrow_funded")
 *   userId    – UID of the acting user, or "SYSTEM" for automated actions
 *   ip        – request IP (null for system actions)
 *   extra     – arbitrary metadata object
 *   createdAt – server timestamp
 */

import { v4 as uuidv4 } from "uuid";
import admin from "../../config/firebase.js";

const db = () => admin.firestore();
const auditLog = () => db().collection("marketplace_audit_log");

/**
 * Write a single audit entry.
 *
 * @param {object} params
 * @param {string} params.orderId
 * @param {string} params.action   e.g. "escrow_funded" | "order_expired"
 * @param {string} params.userId   UID of the actor, or "SYSTEM"
 * @param {object} [params.extra]  Additional context
 * @param {string|null} [params.ip]
 */
export async function writeAudit({ orderId, action, userId, extra = {}, ip = null }) {
  await auditLog().add({
    auditId: uuidv4(),
    orderId,
    action,
    userId,
    ip: ip || null,
    extra,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Write a system-generated audit entry.
 * Identical to writeAudit but fixes userId = "SYSTEM" and ip = null.
 *
 * @param {object} params
 * @param {string} params.orderId
 * @param {string} params.action
 * @param {object} [params.extra]
 */
export async function writeSystemAudit({ orderId, action, extra = {} }) {
  await writeAudit({ orderId, action, userId: "SYSTEM", extra, ip: null });
}
