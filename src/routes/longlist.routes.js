const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const {
  generate,
  getStatus,
  listReports,
  listCategories,
  listVendorsForCategory,
  generateComparison,
  downloadPdf,
} = require("../controllers/longlist");
const { requireAdmin } = require("../middlewares/auth.middleware");

// Rate limit STRICT sur /generate : chaque génération coûte ~$0.20 d'API Claude.
// 5 générations / heure / IP en prod ; on garde aussi un compteur global "best effort"
// (mémoire du process · reset au restart) pour limiter les abus à plus large échelle.
const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1h
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Trop de demandes depuis cette adresse. Merci de réessayer dans une heure ou de nous contacter.",
  },
});

// GET endpoints : limite plus permissive pour permettre du polling status
const readLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/categories", readLimiter, listCategories);
router.get("/vendors/:categoryId", readLimiter, listVendorsForCategory);
router.post("/generate", generateLimiter, generate);
router.post("/compare", generateLimiter, generateComparison);
router.get("/reports", requireAdmin, listReports);
router.get("/status/:id", readLimiter, getStatus);
router.get("/pdf/:id", readLimiter, downloadPdf);

module.exports = router;
