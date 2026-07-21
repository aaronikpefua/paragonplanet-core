import { isAdminUser } from "../lib/adminAccess.js";

export function requireAdmin(req, res, next) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: "Admin permission required" });
  }

  return next();
}
