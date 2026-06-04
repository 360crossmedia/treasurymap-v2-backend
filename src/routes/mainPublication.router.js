const { Router } = require("express");
const {
  updateMainPublication,
  getMainPublications,
  getFullMainPublications,
} = require("../controllers/mainPublication.controllers");
const { requireAdmin } = require("../middlewares/auth.middleware");
const router = Router();

router.get("/", getMainPublications);
router.get("/full", getFullMainPublications);
router.put("/:mainPublicationId", requireAdmin, updateMainPublication);

module.exports = router;
