import admin from "../config/firebase.js";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getPaystackSecret() {
  return process.env.PAYSTACK_SECRET_KEY || "";
}

function requirePaystackSecret(res) {
  if (!getPaystackSecret()) {
    res.status(500).json({ error: "Paystack is not configured yet." });
    return false;
  }
  return true;
}

export async function listBanks(req, res) {
  if (!requirePaystackSecret(res)) return;

  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/bank?country=nigeria&currency=NGN&perPage=500`, {
      headers: {
        Authorization: `Bearer ${getPaystackSecret()}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data?.status) {
      return res.status(400).json({
        error: data?.message || "Could not load bank list",
      });
    }

    const banks = Array.isArray(data.data)
      ? data.data
          .map((bank) => ({
            code: String(bank.code || "").trim(),
            name: String(bank.name || "").trim(),
          }))
          .filter((bank) => bank.code && bank.name)
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

    return res.status(200).json(banks);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not load bank list" });
  }
}

export async function resolveBankAccount(req, res) {
  if (!requirePaystackSecret(res)) return;

  const accountNumber = String(req.body?.accountNumber || "").trim();
  const bankCode = String(req.body?.bankCode || "").trim();

  if (!accountNumber || !bankCode) {
    return res.status(400).json({ error: "Account number and bank code are required" });
  }

  try {
    const url = `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${getPaystackSecret()}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data?.status) {
      return res.status(400).json({
        error: data?.message || "Account verification failed.",
      });
    }

    return res.status(200).json({
      accountName: data?.data?.account_name || "",
      accountNumber: data?.data?.account_number || accountNumber,
      bankCode,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Account verification failed." });
  }
}

export async function requestWithdraw(req, res) {
  const userId = req.user?.uid;
  const amount = Math.floor(Number(req.body?.amount || 0));
  const bankCode = String(req.body?.bankCode || "").trim();
  const accountNumber = String(req.body?.accountNumber || "").trim();

  if (!userId) {
    return res.status(401).json({ error: "Login first" });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Enter withdrawal amount" });
  }

  if (!bankCode || !accountNumber) {
    return res.status(400).json({ error: "Bank code and account number are required" });
  }

  if (!requirePaystackSecret(res)) return;

  try {
    const resolveUrl = `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`;
    const resolveResponse = await fetch(resolveUrl, {
      headers: {
        Authorization: `Bearer ${getPaystackSecret()}`,
      },
    });
    const resolveData = await resolveResponse.json();

    if (!resolveResponse.ok || !resolveData?.status || !resolveData?.data?.account_name) {
      return res.status(400).json({
        error: resolveData?.message || "Account verification failed.",
      });
    }

    const db = admin.firestore();
    const walletRef = db.collection("wallet_accounts").doc(userId);
    const withdrawalRef = db.collection("withdrawals").doc();
    const createdAt = admin.firestore.FieldValue.serverTimestamp();
    const accountName = String(resolveData.data.account_name || "").trim();

    await db.runTransaction(async (transaction) => {
      const walletSnap = await transaction.get(walletRef);
      const walletData = walletSnap.data() || {};
      const balances = walletData.balances || {};
      const lockedBalances = walletData.lockedBalances || {};
      const availableParag = Number(balances.parag || 0);

      if (availableParag < amount) {
        throw new Error("Insufficient PARAG balance for this withdrawal.");
      }

      transaction.set(
        walletRef,
        {
          role: "wallet",
          balances: {
            parag: admin.firestore.FieldValue.increment(-amount),
            gbazilo: admin.firestore.FieldValue.increment(0),
          },
          lockedBalances: {
            parag: admin.firestore.FieldValue.increment(amount),
            gbazilo: admin.firestore.FieldValue.increment(0),
          },
          updatedAt: createdAt,
          _snapshot: {
            availableParagBefore: availableParag,
            lockedParagBefore: Number(lockedBalances.parag || 0),
          },
        },
        { merge: true }
      );

      transaction.set(withdrawalRef, {
        userId,
        amount,
        currency: "PARAG",
        nairaEstimate: amount * 100,
        bankCode,
        accountNumber,
        accountName,
        provider: "paystack",
        status: "pending",
        createdAt,
        updatedAt: createdAt,
      });
    });

    return res.status(200).json({
      ok: true,
      withdrawalId: withdrawalRef.id,
      accountName,
      message: "Withdrawal request submitted",
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Withdrawal failed" });
  }
}
