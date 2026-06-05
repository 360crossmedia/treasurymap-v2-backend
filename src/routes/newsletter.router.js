const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const router = Router();
const { subscribe } = require("../controllers/newsletter.controllers");

// Light abuse protection on a public, unauthenticated endpoint.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many attempts. Please try again in a minute." },
});

router.post("/subscribe", limiter, subscribe);

module.exports = router;
