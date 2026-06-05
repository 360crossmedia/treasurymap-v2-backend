const { Router } = require("express");
const router = Router();
const {
  register,
  login,
  updatePassword,
  resetPassword,
} = require("../controllers/auth.controllers");
const { requireAuth } = require("../middlewares/auth.middleware");

router.post("/register", register);
router.post("/login", login);
// Logged-in change: owner or admin only (enforced in controller).
router.put("/updatePassword/:userId", requireAuth, updatePassword);
// Forgot-password: public, but gated by a server-verified reset token.
router.post("/reset-password", resetPassword);

module.exports = router;
