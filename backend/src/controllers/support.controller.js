import admin from "../config/firebase.js";

const SUPPORT_ACTIONS = {
  vote: { parag: 1, gbazilo: 0, group: "vote" },
  pour_me_water: { parag: 5, gbazilo: 0, group: "spray" },
  spray_money: { parag: 0, gbazilo: 0, group: "spray", variable: true },
  mineral: { parag: 2, gbazilo: 0, group: "bottle" },
  malt: { parag: 3, gbazilo: 0, group: "bottle" },
  juice: { parag: 4, gbazilo: 0, group: "bottle" },
  mocktail: { parag: 5, gbazilo: 0, group: "bottle" },
  beer: { parag: 6, gbazilo: 0, group: "bottle" },
  gin: { parag: 7, gbazilo: 0, group: "bottle" },
  rum: { parag: 8, gbazilo: 0, group: "bottle" },
  vodka: { parag: 9, gbazilo: 0, group: "bottle" },
  whiskey: { parag: 0, gbazilo: 1, group: "bottle" },
  cocktail: { parag: 2, gbazilo: 1, group: "bottle" },
};

function getActionAmounts(action, body = {}) {
  if (!action.variable) {
    return {
      amountParag: Number(action.parag || 0),
      amountGbazilo: Number(action.gbazilo || 0),
    };
  }

  const amountParag = Math.max(0, Number(body.customParagAmount || 0) || 0);
  const amountGbazilo = Math.max(0, Number(body.customGbaziloAmount || 0) || 0);

  if (amountParag <= 0 && amountGbazilo <= 0) {
    return { amountParag: 1, amountGbazilo: 0 };
  }

  return { amountParag, amountGbazilo };
}

export async function supportVideo(req, res) {
  const { videoId } = req.params;
  const { actionKey } = req.body || {};
  const userId = req.user?.uid;
  const action = SUPPORT_ACTIONS[actionKey];

  if (!videoId) {
    return res.status(400).json({ error: "Video id is required" });
  }

  if (!userId) {
    return res.status(401).json({ error: "Login first" });
  }

  if (!action) {
    return res.status(400).json({ error: "Unsupported support action" });
  }

  const { amountParag, amountGbazilo } = getActionAmounts(action, req.body);
  const db = admin.firestore();
  const videoRef = db.collection("videos").doc(videoId);
  const supportRef = db.collection("video_supports").doc();
  const supporterWalletRef = db.collection("wallet_accounts").doc(userId);
  const supporterLedgerRef = db.collection("ledger_entries").doc();
  const creatorLedgerRef = db.collection("ledger_entries").doc();

  try {
    await db.runTransaction(async (transaction) => {
      const [videoSnap, supporterWalletSnap] = await Promise.all([
        transaction.get(videoRef),
        transaction.get(supporterWalletRef),
      ]);

      if (!videoSnap.exists) {
        throw Object.assign(new Error("Video not found"), { status: 404 });
      }

      const video = videoSnap.data() || {};
      const creatorId = video.uid || "";

      if (creatorId && creatorId === userId) {
        throw Object.assign(new Error("You cannot support your own video."), { status: 400 });
      }

      const supporterWallet = supporterWalletSnap.data() || {};
      const supporterParag = Number(supporterWallet.balances?.parag || 0);
      const supporterGbazilo = Number(supporterWallet.balances?.gbazilo || 0);

      if (amountParag > 0 && supporterParag < amountParag) {
        throw Object.assign(new Error("Insufficient PARAG balance."), { status: 400 });
      }

      if (amountGbazilo > 0 && supporterGbazilo < amountGbazilo) {
        throw Object.assign(new Error("Insufficient GBAZILO balance."), { status: 400 });
      }

      const createdAt = admin.firestore.FieldValue.serverTimestamp();
      const currency =
        amountParag > 0 && amountGbazilo > 0
          ? "MIXED"
          : amountGbazilo > 0
            ? "GBAZILO"
            : "PARAG";
      const ledgerAmount = amountParag > 0 && amountGbazilo > 0 ? amountParag + amountGbazilo : amountParag || amountGbazilo;

      const updates = {
        [`supportCounts.${actionKey}`]: admin.firestore.FieldValue.increment(1),
        updatedAt: createdAt,
      };

      if (action.group === "vote") {
        updates.votes = admin.firestore.FieldValue.increment(1);
      }

      transaction.set(
        supporterWalletRef,
        {
          role: "wallet",
          balances: {
            parag: admin.firestore.FieldValue.increment(-amountParag),
            gbazilo: admin.firestore.FieldValue.increment(-amountGbazilo),
          },
          lockedBalances: {
            parag: admin.firestore.FieldValue.increment(0),
            gbazilo: admin.firestore.FieldValue.increment(0),
          },
          updatedAt: createdAt,
        },
        { merge: true }
      );

      if (creatorId) {
        const creatorWalletRef = db.collection("wallet_accounts").doc(creatorId);
        transaction.set(
          creatorWalletRef,
          {
            role: "wallet",
            balances: {
              parag: admin.firestore.FieldValue.increment(amountParag),
              gbazilo: admin.firestore.FieldValue.increment(amountGbazilo),
            },
            lockedBalances: {
              parag: admin.firestore.FieldValue.increment(0),
              gbazilo: admin.firestore.FieldValue.increment(0),
            },
            updatedAt: createdAt,
          },
          { merge: true }
        );
      }

      transaction.update(videoRef, updates);
      transaction.set(supportRef, {
        videoId,
        actionKey,
        group: action.group,
        supporterId: userId,
        creatorId,
        amountParag,
        amountGbazilo,
        createdAt,
      });

      transaction.set(supporterLedgerRef, {
        accountId: userId,
        counterpartyId: creatorId,
        direction: "debit",
        amount: ledgerAmount,
        amountParag,
        amountGbazilo,
        currency,
        reason: `Video support: ${actionKey}`,
        supportId: supportRef.id,
        videoId,
        createdAt,
      });

      if (creatorId) {
        transaction.set(creatorLedgerRef, {
          accountId: creatorId,
          counterpartyId: userId,
          direction: "credit",
          amount: ledgerAmount,
          amountParag,
          amountGbazilo,
          currency,
          reason: `Video support received: ${actionKey}`,
          supportId: supportRef.id,
          videoId,
          createdAt,
        });
      }
    });

    return res.status(200).json({
      ok: true,
      videoId,
      actionKey,
      amountParag,
      amountGbazilo,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      error: error.message || "This support action could not be completed.",
    });
  }
}

export async function supportSuperboss(req, res) {
  const { supernalId } = req.params;
  const userId = req.user?.uid;
  const amountParag = Math.floor(Number(req.body?.amountParag || 0));

  if (!supernalId) {
    return res.status(400).json({ error: "Superboss id is required" });
  }

  if (!userId) {
    return res.status(401).json({ error: "Login first" });
  }

  if (supernalId === userId) {
    return res.status(400).json({ error: "You cannot donate to your own Superboss profile." });
  }

  if (!Number.isFinite(amountParag) || amountParag < 1 || amountParag > 10000) {
    return res.status(400).json({ error: "Donation amount must be between 1 and 10,000 PARAG." });
  }

  const db = admin.firestore();
  const supporterWalletRef = db.collection("wallet_accounts").doc(userId);
  const supernalWalletRef = db.collection("wallet_accounts").doc(supernalId);
  const supernalRef = db.collection("supernal_profiles").doc(supernalId);
  const donationRef = db.collection("supernal_donations").doc();
  const supporterLedgerRef = db.collection("ledger_entries").doc();
  const supernalLedgerRef = db.collection("ledger_entries").doc();

  try {
    await db.runTransaction(async (transaction) => {
      const [supporterWalletSnap, supernalSnap] = await Promise.all([
        transaction.get(supporterWalletRef),
        transaction.get(supernalRef),
      ]);

      if (!supernalSnap.exists) {
        throw Object.assign(new Error("Superboss profile not found."), { status: 404 });
      }

      const supporterWallet = supporterWalletSnap.data() || {};
      const supporterParag = Number(supporterWallet.balances?.parag || 0);

      if (supporterParag < amountParag) {
        throw Object.assign(new Error("Insufficient PARAG balance."), { status: 400 });
      }

      const supernal = supernalSnap.data() || {};
      const createdAt = admin.firestore.FieldValue.serverTimestamp();

      transaction.set(
        supporterWalletRef,
        {
          role: "wallet",
          balances: {
            parag: admin.firestore.FieldValue.increment(-amountParag),
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

      transaction.set(
        supernalWalletRef,
        {
          role: "wallet",
          balances: {
            parag: admin.firestore.FieldValue.increment(amountParag),
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

      transaction.set(donationRef, {
        supernalId,
        supernalName: supernal.stageName || supernal.realName || supernal.name || "Superboss",
        supporterId: userId,
        amountParag,
        currency: "PARAG",
        purpose: "superboss_question_fund",
        createdAt,
      });

      transaction.set(supporterLedgerRef, {
        accountId: userId,
        counterpartyId: supernalId,
        direction: "debit",
        amount: amountParag,
        amountParag,
        amountGbazilo: 0,
        currency: "PARAG",
        reason: "Superboss donation",
        donationId: donationRef.id,
        createdAt,
      });

      transaction.set(supernalLedgerRef, {
        accountId: supernalId,
        counterpartyId: userId,
        direction: "credit",
        amount: amountParag,
        amountParag,
        amountGbazilo: 0,
        currency: "PARAG",
        reason: "Superboss donation received",
        donationId: donationRef.id,
        createdAt,
      });

      transaction.update(supernalRef, {
        "donationStats.totalParag": admin.firestore.FieldValue.increment(amountParag),
        "donationStats.count": admin.firestore.FieldValue.increment(1),
        updatedAt: createdAt,
      });
    });

    return res.status(200).json({
      ok: true,
      supernalId,
      amountParag,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      error: error.message || "This donation could not be completed.",
    });
  }
}
