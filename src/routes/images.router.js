const { Router } = require("express");
const router = Router();
const { uploadImage, getImage } = require("../controllers/images.router");
const { requireAuth } = require("../middlewares/auth.middleware");

router.post("/", requireAuth, uploadImage);
router.get("/:id", getImage);

module.exports = router;
