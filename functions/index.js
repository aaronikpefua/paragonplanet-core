/**
 * Paragon Planet – Firebase Cloud Functions
 *
 * Exports all scheduled marketplace automation jobs.
 * Each job is registered with Firebase Cloud Scheduler.
 *
 * Scheduled jobs:
 *   checkDeliveryDeadlines          – every 15 min
 *   checkBuyerReviewDeadlines        – every 15 min
 *   checkDisputeEvidenceDeadlines    – every 15 min
 *   checkMerchantResponseDeadlines   – every 15 min
 *   sendDeadlineReminders            – every 1 hour
 */

export {
  checkDeliveryDeadlines,
  checkBuyerReviewDeadlines,
  checkDisputeEvidenceDeadlines,
  checkMerchantResponseDeadlines,
} from "./src/scheduledJobs.js";

export { sendDeadlineReminders } from "./src/reminderJobs.js";
