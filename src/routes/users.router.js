const { Router } = require("express");
const router = Router();
const {
  getAllUsers,
  getUserById,
  updateUserById,
} = require("../controllers/users.controller");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");

// Listing every user (incl. emails) is admin-only. The admin dashboard sends
// the logged-in admin token via the default Authorization header.
router.get("/", requireAdmin, getAllUsers);
// A single user is readable by that user (My Account) or the admin; the
// controller enforces the self-or-admin check. Never public.
router.get("/:id", requireAuth, getUserById);
router.put("/:id", requireAuth, updateUserById);

module.exports = router;
