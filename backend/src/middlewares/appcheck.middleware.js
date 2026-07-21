import admin from "../config/firebase.js";

const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === "true";
const TRUSTED_NATIVE_TESTER_EMAILS = new Set(
  (
    process.env.TRUSTED_NATIVE_TESTER_EMAILS ||
    "natureswaypro2@gmail.com,natureswayproductionapp@gmail.com"
  )
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

async function resolveAuthenticatedUser(req) {
  if (req.user?.email) return req.user;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      phoneNumber: decodedToken.phone_number,
      role: decodedToken.role || "user",
      admin: decodedToken.admin === true,
    };
    return req.user;
  } catch {
    return null;
  }
}

async function allowTrustedTesterBypass(req) {
  const user = await resolveAuthenticatedUser(req);
  const email = user?.email?.toLowerCase();

  if (email && TRUSTED_NATIVE_TESTER_EMAILS.has(email)) {
    req.appCheck = {
      verified: false,
      bypass: true,
      reason: "trusted-native-tester",
      email,
    };
    console.warn(`App Check bypass granted for trusted native tester: ${email}`);
    return true;
  }

  return false;
}

async function allowAuthenticatedAppBypass(req, reason = "authenticated-app-fallback") {
  const user = await resolveAuthenticatedUser(req);

  if (user?.uid) {
    req.appCheck = {
      verified: false,
      bypass: true,
      reason,
      uid: user.uid,
      email: user.email || null,
    };
    console.warn(
      `App Check bypass granted for ${reason}: ${user.email || user.uid}`
    );
    return true;
  }

  return false;
}

async function maybeBypassForTrustedTester(req, res, next, failureMessage) {
  if (await allowTrustedTesterBypass(req)) {
    return next();
  }

  return res.status(401).json({ error: failureMessage });
}

export async function verifyAppCheck(req, res, next) {
  const token = req.header("X-Firebase-AppCheck");

  if (!token) {
    if (ENFORCE_APP_CHECK) {
      return maybeBypassForTrustedTester(req, res, next, "App Check token required");
    }

    req.appCheck = { verified: false };
    return next();
  }

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(token);
    req.appCheck = { verified: true, appId: appCheckClaims.appId };
    return next();
  } catch (error) {
    if (ENFORCE_APP_CHECK) {
      console.warn("Invalid App Check token received", error?.message || error);
      return maybeBypassForTrustedTester(req, res, next, "Invalid App Check token");
    }

    console.warn("Invalid App Check token received", error?.message || error);
    req.appCheck = { verified: false };
    return next();
  }
}

export async function verifyAppCheckOrTrustedTester(req, res, next) {
  const token = req.header("X-Firebase-AppCheck");

  if (!token) {
    if (ENFORCE_APP_CHECK) {
      return maybeBypassForTrustedTester(req, res, next, "App Check token required");
    }

    req.appCheck = { verified: false };
    return next();
  }

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(token);
    req.appCheck = { verified: true, appId: appCheckClaims.appId };
    return next();
  } catch (error) {
    if (ENFORCE_APP_CHECK) {
      console.warn("Invalid App Check token received", error?.message || error);
      return maybeBypassForTrustedTester(req, res, next, "Invalid App Check token");
    }

    req.appCheck = { verified: false };
    return next();
  }
}

export async function verifyAppCheckOrUploadAuth(req, res, next) {
  const token = req.header("X-Firebase-AppCheck");

  if (!token) {
    if (ENFORCE_APP_CHECK) {
      if (await allowTrustedTesterBypass(req)) {
        return next();
      }

      if (await allowAuthenticatedAppBypass(req, "authenticated-upload-fallback")) {
        return next();
      }

      return res.status(401).json({ error: "App Check token required" });
    }

    req.appCheck = { verified: false };
    return next();
  }

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(token);
    req.appCheck = { verified: true, appId: appCheckClaims.appId };
    return next();
  } catch (error) {
    if (ENFORCE_APP_CHECK) {
      console.warn("Invalid App Check token received", error?.message || error);

      if (await allowTrustedTesterBypass(req)) {
        return next();
      }

      if (await allowAuthenticatedAppBypass(req, "authenticated-upload-fallback")) {
        return next();
      }

      return res.status(401).json({ error: "Invalid App Check token" });
    }

    req.appCheck = { verified: false };
    return next();
  }
}

export async function verifyAppCheckOrAuthenticatedUser(req, res, next) {
  const token = req.header("X-Firebase-AppCheck");

  if (!token) {
    if (ENFORCE_APP_CHECK) {
      if (await allowTrustedTesterBypass(req)) {
        return next();
      }

      if (await allowAuthenticatedAppBypass(req, "authenticated-native-fallback")) {
        return next();
      }

      return res.status(401).json({ error: "App Check token required" });
    }

    req.appCheck = { verified: false };
    return next();
  }

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(token);
    req.appCheck = { verified: true, appId: appCheckClaims.appId };
    return next();
  } catch (error) {
    if (ENFORCE_APP_CHECK) {
      console.warn("Invalid App Check token received", error?.message || error);

      if (await allowTrustedTesterBypass(req)) {
        return next();
      }

      if (await allowAuthenticatedAppBypass(req, "authenticated-native-fallback")) {
        return next();
      }

      return res.status(401).json({ error: "Invalid App Check token" });
    }

    req.appCheck = { verified: false };
    return next();
  }
}
