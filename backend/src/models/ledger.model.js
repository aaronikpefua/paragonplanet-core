import { v4 as uuidv4 } from "uuid";

/**
 * Ledger Entry
 * type: CREDIT | DEBIT
 * currency: PARAG | GBAZILO
 */
export function createLedgerEntry({
  walletId,
  type,
  amount,
  currency,
  reason,
  reference
}) {
  return {
    ledgerId: uuidv4(),
    walletId,
    type,
    amount,
    currency,
    reason,
    reference,
    createdAt: new Date().toISOString()
  };
}
