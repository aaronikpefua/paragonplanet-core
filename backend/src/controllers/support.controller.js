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
  return supportRoleProfile(req, res, {
    roleKey: "supernal",
    profileId: req.params.supernalId,
    profileCollection: "supernal_profiles",
    supportCollection: "supernal_donations",
    profileIdField: "supernalId",
    profileNameField: "supernalName",
    roleLabel: "Superboss",
  });
}

export async function supportBacker(req, res) {
  return supportRoleProfile(req, res, {
    roleKey: "backer",
    profileId: req.params.backerId,
    profileCollection: "backer_profiles",
    supportCollection: "backer_donations",
    profileIdField: "backerId",
    profileNameField: "backerName",
    roleLabel: "Backer",
  });
}

async function supportRoleProfile(req, res, config) {
  const userId = req.user?.uid;
  const actionKey = String(req.body?.actionKey || "donate").trim().toLowerCase();
  const amountParag = actionKey === "vote" ? 1 : Math.floor(Number(req.body?.amountParag || 0));

  if (!config.profileId) {
    return res.status(400).json({ error: `${config.roleLabel} id is required` });
  }

  if (!userId) {
    return res.status(401).json({ error: "Login first" });
  }

  if (config.profileId === userId) {
    return res.status(400).json({ error: `You cannot support your own ${config.roleLabel} profile.` });
  }

  if (!["vote", "donate"].includes(actionKey)) {
    return res.status(400).json({ error: "Unsupported support action" });
  }

  if (!Number.isFinite(amountParag) || amountParag < 1 || amountParag > 10000) {
    return res.status(400).json({ error: "Amount must be between 1 and 10,000 PARAG." });
  }

  const db = admin.firestore();
  const supporterWalletRef = db.collection("wallet_accounts").doc(userId);
  const recipientWalletRef = db.collection("wallet_accounts").doc(config.profileId);
  const profileRef = db.collection(config.profileCollection).doc(config.profileId);
  const supportRef = db.collection(config.supportCollection).doc();
  const voteRef = db.collection(`${config.roleKey}_votes`).doc();
  const supporterLedgerRef = db.collection("ledger_entries").doc();
  const recipientLedgerRef = db.collection("ledger_entries").doc();

  try {
    await db.runTransaction(async (transaction) => {
      const [supporterWalletSnap, profileSnap] = await Promise.all([
        transaction.get(supporterWalletRef),
        transaction.get(profileRef),
      ]);

      if (!profileSnap.exists) {
        throw Object.assign(new Error(`${config.roleLabel} profile not found.`), { status: 404 });
      }

      const supporterWallet = supporterWalletSnap.data() || {};
      const supporterParag = Number(supporterWallet.balances?.parag || 0);

      if (supporterParag < amountParag) {
        throw Object.assign(new Error("Insufficient PARAG balance."), { status: 402 });
      }

      const profile = profileSnap.data() || {};
      const profileName = profile.stageName || profile.realName || profile.name || profile.brandName || profile.email || config.roleLabel;
      const createdAt = admin.firestore.FieldValue.serverTimestamp();
      const supportId = actionKey === "vote" ? voteRef.id : supportRef.id;
      const reason = `${config.roleLabel} ${actionKey}`;

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
        recipientWalletRef,
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

      const supportPayload = {
        [config.profileIdField]: config.profileId,
        [config.profileNameField]: profileName,
        supporterId: userId,
        actionKey,
        amountParag,
        currency: "PARAG",
        createdAt,
      };

      if (actionKey === "vote") {
        transaction.set(voteRef, {
          ...supportPayload,
          voterId: userId,
          voterName: req.user?.name || req.user?.email || "Paragon Member",
          status: "published",
        });
      } else {
        transaction.set(supportRef, {
          ...supportPayload,
          purpose: `${config.roleKey}_support`,
        });
      }

      transaction.set(supporterLedgerRef, {
        accountId: userId,
        counterpartyId: config.profileId,
        direction: "debit",
        amount: amountParag,
        amountParag,
        amountGbazilo: 0,
        currency: "PARAG",
        reason,
        supportId,
        createdAt,
      });

      transaction.set(recipientLedgerRef, {
        accountId: config.profileId,
        counterpartyId: userId,
        direction: "credit",
        amount: amountParag,
        amountParag,
        amountGbazilo: 0,
        currency: "PARAG",
        reason: `${reason} received`,
        supportId,
        createdAt,
      });

      transaction.update(profileRef, {
        [`supportStats.${actionKey}Parag`]: admin.firestore.FieldValue.increment(amountParag),
        [`supportStats.${actionKey}Count`]: admin.firestore.FieldValue.increment(1),
        ...(actionKey === "vote"
          ? { votes: admin.firestore.FieldValue.increment(1), score: admin.firestore.FieldValue.increment(1) }
          : { "donationStats.totalParag": admin.firestore.FieldValue.increment(amountParag), "donationStats.count": admin.firestore.FieldValue.increment(1) }),
        updatedAt: createdAt,
      });
    });

    return res.status(200).json({
      ok: true,
      actionKey,
      profileId: config.profileId,
      amountParag,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      error: error.message || "This support action could not be completed.",
    });
  }
}
