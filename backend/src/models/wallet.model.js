import { v4 as uuidv4 } from "uuid";

export function createWallet(userId) {
  return {
    walletId: uuidv4(),
    userId,
    createdAt: new Date().toISOString(),
    status: "ACTIVE"
  };
}
