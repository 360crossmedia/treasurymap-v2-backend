const { Router } = require("express");
const router = Router();
const {
  getAllUsers,
  getUserById,
  updateUserById,
} = require("../controllers/users.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.put("/:id", requireAuth, updateUserById);

module.exports = router;
