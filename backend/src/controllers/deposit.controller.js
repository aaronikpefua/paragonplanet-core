import admin from "../config/firebase.js";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PARAG_NAIRA_PRICE = 100;

export async function initializeDeposit(req, res) {
  const userId = req.user?.uid;
  const email = req.user?.email;
  const amountNaira = Math.floor(Number(req.body?.amount || 0));

  if (!userId) {
    return res.status(401).json({ error: "Login first" });
  }

  if (!email) {
    return res.status(400).json({ error: "An email address is required to initialize deposit." });
  }

  if (!Number.isFinite(amountNaira) || amountNaira < PARAG_NAIRA_PRICE) {
    return res.status(400).json({ error: "Minimum deposit is ₦100." });
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return res.status(500).json({ error: "Paystack is not configured yet." });
  }

  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountNaira * 100,
        callback_url: `${process.env.FRONTEND_ORIGIN || "https://www.paragonplanet.com"}/wallet`,
        metadata: {
          userId,
          walletPurpose: "parag_wallet_deposit",
          creditedParag: Math.floor(amountNaira / PARAG_NAIRA_PRICE),
        },
      }),
    });

    const data = await response.json();

    if (!response.ok || !data?.status) {
      return res.status(400).json({
        error: data?.message || "Paystack deposit could not be initialized.",
      });
    }

    return res.status(200).json({
      authorization_url: data.data?.authorization_url,
      access_code: data.data?.access_code,
      reference: data.data?.reference,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Paystack deposit could not be initialized.",
    });
  }
}

export async function verifyDeposit(req, res) {
  const userId = req.user?.uid;
  const reference = String(req.query?.reference || req.body?.reference || "").trim();

  if (!userId) {
    return res.status(401).json({ error: "Login first" });
  }

  if (!reference) {
    return res.status(400).json({ error: "Payment reference is required." });
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return res.status(500).json({ error: "Paystack is not configured yet." });
  }

  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data?.status || data.data?.status !== "success") {
      return res.status(400).json({
        error: data?.message || "Payment has not been completed yet.",
      });
    }

    const metadataUserId = data.data?.metadata?.userId;
    if (metadataUserId && metadataUserId !== userId) {
      return res.status(403).json({ error: "This payment reference belongs to another user." });
    }

    const amountNaira = Math.floor(Number(data.data?.amount || 0) / 100);
    const creditedParag = Math.floor(amountNaira / PARAG_NAIRA_PRICE);

    if (creditedParag < 1) {
      return res.status(400).json({ error: "Payment amount is too low to credit PARAG." });
    }

    const db = admin.firestore();
    const walletRef = db.collection("wallet_accounts").doc(userId);
    const ledgerRef = db.collection("ledger_entries").doc(`paystack_${safeDocId(reference)}`);
    const depositRef = db.collection("deposits").doc(`paystack_${safeDocId(reference)}`);

    let alreadyProcessed = false;

    await db.runTransaction(async (transaction) => {
      const ledgerSnap = await transaction.get(ledgerRef);
      const createdAt = admin.firestore.FieldValue.serverTimestamp();

      if (ledgerSnap.exists) {
        alreadyProcessed = true;
        return;
      }

      transaction.set(
        walletRef,
        {
          role: "wallet",
          balances: {
            parag: admin.firestore.FieldValue.increment(creditedParag),
            gbazilo: admin.firestore.FieldValue.increment(0),
          },
          lockedBalances: {
            parag: admin.firestore.FieldValue.increment(0),
            gbazilo: admin.firestore.FieldValue.increment(0),
          },
          updatedAt: createdAt,
        },
        { merge: true }
      );

      transaction.set(ledgerRef, {
        accountId: userId,
        direction: "credit",
        amount: creditedParag,
        amountParag: creditedParag,
        amountGbazilo: 0,
        currency: "PARAG",
        reason: "Paystack wallet deposit",
        provider: "paystack",
        reference,
        amountNaira,
        createdAt,
      });

      transaction.set(depositRef, {
        userId,
        provider: "paystack",
        reference,
        amountNaira,
        creditedParag,
        status: "success",
        createdAt,
      });
    });

    return res.status(200).json({
      ok: true,
      reference,
      creditedParag,
      alreadyProcessed,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Payment verification failed.",
    });
  }
}

function safeDocId(value) {
  return String(value || "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
}
