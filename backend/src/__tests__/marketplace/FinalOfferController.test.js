import { beforeEach, describe, expect, it, vi } from "vitest";

const txUpdate = vi.fn();
const txSet = vi.fn();
const orderGet = vi.fn();
const messageDoc = {};
const orderDoc = { get: orderGet };

let mockOrder;

const collection = vi.fn((name) => ({
  doc: vi.fn(() => (name === "merchant_orders" ? orderDoc : messageDoc)),
  add: vi.fn().mockResolvedValue({}),
}));

const runTransaction = vi.fn(async (callback) =>
  callback({
    get: vi.fn().mockResolvedValue({ exists: true, data: () => mockOrder }),
    update: txUpdate,
    set: txSet,
  })
);

vi.mock("../../config/firebase.js", () => ({
  default: {
    firestore: Object.assign(
      () => ({
        collection,
        runTransaction,
      }),
      {
        FieldValue: {
          serverTimestamp: vi.fn(() => "SERVER_TS"),
        },
      }
    ),
  },
}));

vi.mock("../../services/marketplace/AuditService.js", () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
  writeSystemAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/marketplace/NotificationService.js", () => ({
  pushNotification: vi.fn().mockResolvedValue(undefined),
  pushNotifications: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../models/ledger.model.js", () => ({
  createLedgerEntry: vi.fn(),
}));

const { sendFinalOffer } = await import("../../controllers/marketplace.controller.js");
const { writeAudit } = await import("../../services/marketplace/AuditService.js");
const { pushNotification } = await import("../../services/marketplace/NotificationService.js");

function response() {
  const res = {
    statusCode: 200,
    body: null,
    status: vi.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((body) => {
      res.body = body;
      return res;
    }),
  };
  return res;
}

describe("sendFinalOffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder = {
      buyerId: "buyer-1",
      buyerName: "Buyer One",
      merchantId: "merchant-1",
      merchantName: "Merchant One",
      productId: "product-1",
      productName: "Product One",
      status: "negotiating",
      currency: "PARAG",
    };
    orderGet.mockResolvedValue({ exists: true, data: () => mockOrder });
  });

  it("updates the order, writes a final-offer message, audit, and notification", async () => {
    const req = {
      user: { uid: "merchant-1", email: "merchant@example.com" },
      body: { orderId: "order-1", amount: 125, message: "Final price is 125 PARAG" },
      ip: "127.0.0.1",
    };
    const res = response();

    await sendFinalOffer(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      orderId: "order-1",
      status: "final_offer_sent",
      amount: 125,
      currency: "PARAG",
    });
    expect(txUpdate).toHaveBeenCalledWith(
      orderDoc,
      expect.objectContaining({
        status: "final_offer_sent",
        amount: 125,
        finalOfferAmount: 125,
        finalOfferSentBy: "merchant-1",
      })
    );
    expect(txSet).toHaveBeenCalledWith(
      messageDoc,
      expect.objectContaining({
        orderId: "order-1",
        buyerId: "buyer-1",
        merchantId: "merchant-1",
        senderId: "merchant-1",
        type: "final_offer",
        messageType: "final_offer",
        text: "Final price is 125 PARAG",
      })
    );
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      orderId: "order-1",
      action: "final_offer_sent",
      userId: "merchant-1",
    }));
    expect(pushNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: "buyer-1",
      type: "final_offer",
      orderId: "order-1",
    }));
  });

  it("rejects a merchant that does not own the order", async () => {
    const res = response();

    await sendFinalOffer(
      {
        user: { uid: "merchant-2" },
        body: { orderId: "order-1", amount: 125 },
      },
      res
    );

    expect(res.statusCode).toBe(403);
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it("rejects final offers after escrow is funded", async () => {
    mockOrder.status = "escrow_funded";
    const res = response();

    await sendFinalOffer(
      {
        user: { uid: "merchant-1" },
        body: { orderId: "order-1", amount: 125 },
      },
      res
    );

    expect(res.statusCode).toBe(409);
    expect(txUpdate).not.toHaveBeenCalled();
  });
});
