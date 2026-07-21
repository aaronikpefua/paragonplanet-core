import admin from "../config/firebase.js";

const identifier = process.argv[2];

if (!identifier) {
  console.error("Usage: node src/scripts/setAdminClaim.js <email-or-uid>");
  process.exit(1);
}

async function findUser(value) {
  if (value.includes("@")) {
    return admin.auth().getUserByEmail(value);
  }

  return admin.auth().getUser(value);
}

try {
  const user = await findUser(identifier);
  await admin.auth().setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    admin: true,
    role: "admin",
  });

  console.log(`Admin custom claim set for ${user.uid}`);
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
