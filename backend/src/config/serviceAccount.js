import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadServiceAccount() {
  if (process.env.FIREBASE_ADMIN_JSON) {
    return JSON.parse(process.env.FIREBASE_ADMIN_JSON);
  }

  if (process.env.FIREBASE_ADMIN_JSON_BASE64) {
    return JSON.parse(
      Buffer.from(process.env.FIREBASE_ADMIN_JSON_BASE64, "base64").toString("utf8")
    );
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  const serviceAccountPath = path.join(
    __dirname,
    "../../credentials/firebase-admin.json"
  );

  return JSON.parse(readFileSync(serviceAccountPath, "utf8"));
}
