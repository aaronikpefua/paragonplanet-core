/**
 * NotificationService – in-app notifications for Marketplace events.
 *
 * Writes to the marketplace_notifications collection.
 * Callers are responsible for also triggering FCM/email where appropriate.
 *
 * Schema (marketplace_notifications):
 *   recipientId – UID or "ADMIN"
 *   type        – notification type key
 *   title       – short display title
 *   body        – longer description
 *   orderId     – associated order
 *   read        – false on creation
 *   createdAt   – server timestamp
 */

import admin from "../../config/firebase.js";

const db = () => admin.firestore();
const notifications = () => db().collection("marketplace_notifications");

/**
 * Push an in-app notification to one recipient.
 *
 * @param {object} params
 * @param {string} params.recipientId   UID or "ADMIN"
 * @param {string} params.type          e.g. "escrow_funded" | "order_expired"
 * @param {string} params.title
 * @param {string} params.body
 * @param {string} params.orderId
 */
export async function pushNotification({ recipientId, type, title, body, orderId }) {
  await notifications().add({
    recipientId,
    type,
    title,
    body,
    orderId,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Push the same notification to multiple recipients at once.
 * Uses a batch write for efficiency.
 *
 * @param {Array<{recipientId:string, type:string, title:string, body:string, orderId:string}>} items
 */
export async function pushNotifications(items) {
  if (!items || items.length === 0) return;
  const batch = db().batch();
  for (const item of items) {
    batch.set(notifications().doc(), {
      recipientId: item.recipientId,
      type: item.type,
      title: item.title,
      body: item.body,
      orderId: item.orderId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}
