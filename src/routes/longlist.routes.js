const express = require("express");
const router = express.Router();
const { generate, getStatus, listCategories } = require("../controllers/longlist");

router.get("/categories", listCategories);
router.post("/generate", generate);
router.get("/status/:id", getStatus);

module.exports = router;
