import admin from "firebase-admin";
import { loadServiceAccount } from "./serviceAccount.js";

const serviceAccount = loadServiceAccount();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export default admin;
