const { Router } = require("express");
const router = Router();
const {
  register,
  login,
  updatePassword,
  resetPassword,
  createMagicLink,
  magicLogin,
} = require("../controllers/auth.controllers");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimit.middleware");

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
// Logged-in change: owner or admin only (enforced in controller).
router.put("/updatePassword/:userId", requireAuth, updatePassword);
// Forgot-password: public, but gated by a server-verified reset token.
router.post("/reset-password", authLimiter, resetPassword);
// Magic edit-link: admin mints (requireAdmin), vendor exchanges for a session.
router.post("/magic-link", requireAdmin, createMagicLink);
router.post("/magic-login", authLimiter, magicLogin);

module.exports = router;
