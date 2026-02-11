import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * Returns authenticated user info
 * Used by frontend to confirm session
 */
router.get("/me", authenticate, (req, res) => {
  res.json({
    uid: req.user.uid,
    email: req.user.email,
    role: req.user.role
  });
});

/**
 * Logout is handled client-side by Firebase.
 * This endpoint exists for future token revocation.
 */
router.post("/logout", authenticate, async (req, res) => {
  res.status(200).json({ message: "Logged out" });
});

export default router;
