const { Router } = require("express");
const router = Router();
const { uploadImage } = require("../controllers/images.router");
const { requireAuth } = require("../middlewares/auth.middleware");

router.post("/", requireAuth, uploadImage);

module.exports = router;
