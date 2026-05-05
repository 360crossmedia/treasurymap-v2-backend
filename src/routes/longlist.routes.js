const express = require("express");
const router = express.Router();
const { generate, getStatus } = require("../controllers/longlist");

router.post("/generate", generate);
router.get("/status/:id", getStatus);

module.exports = router;
