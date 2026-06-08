const { Router } = require("express");
const router = Router();
const {
  CreateArticle,
  GetAllArticles,
  GetArticleByCompanyId,
  DeleteArticle,
  GetArticleById,
  updateArticle,
} = require("../controllers/articles.controllers");
const { requireAuth, optionalAuth } = require("../middlewares/auth.middleware");
const {
  ownsCompanyByParam,
  ownsArticle,
} = require("../middlewares/ownership.middleware");

// optionalAuth: admin (token) gets all incl. drafts; public gets live-only.
router.get("/", optionalAuth, GetAllArticles);
router.get("/all/:companyId", GetArticleByCompanyId);
router.get("/:articleId", GetArticleById);
router.post("/create/:companyId", requireAuth, ownsCompanyByParam("companyId"), CreateArticle);
router.put("/:articleId", requireAuth, ownsArticle, updateArticle);
router.delete("/:articleid", requireAuth, ownsArticle, DeleteArticle);

module.exports = router;
