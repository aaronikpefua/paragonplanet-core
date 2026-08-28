# Marketplace Architecture

## Current Flow

```text
merchant onboarding/product creation
-> buyer request/conversation
-> merchant final offer
-> buyer pays from wallet
-> escrow is funded
-> merchant submits delivery
-> buyer confirms or deadline expires
-> release/refund/platform fee
-> dispute/admin override when needed
```

## Backend Owners

- `marketplace.controller.js`: transaction flow, disputes, delivery, settings, notifications, admin dashboard.
- `EscrowService.js`: escrow release, refund, commission, wallet and ledger transaction mechanics.
- `DeadlineService.js`: deadline/automation calculations.
- `AuditService.js`: `marketplace_audit_log`.
- `NotificationService.js`: `marketplace_notifications`.
- `marketplace.routes.js`: buyer/merchant/admin route exposure and rate limits.

## Collections

- `merchant_products`
- `merchant_orders`
- `merchant_order_messages`
- `marketplace_escrow`
- `marketplace_deliveries`
- `marketplace_disputes`
- `marketplace_notifications`
- `marketplace_audit_log`
- `marketplace_settings`
- `wallet_accounts`
- `ledger_entries`

## Natural Boundaries

Catalog/media, order negotiation, escrow settlement, delivery/deadlines, disputes/admin, notifications, and audit are natural internal service boundaries. Evidence does not justify splitting marketplace into independent infrastructure yet.
