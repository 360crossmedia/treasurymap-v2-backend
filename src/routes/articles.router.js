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
const { requireAuth } = require("../middlewares/auth.middleware");

router.get("/", GetAllArticles);
router.get("/all/:companyId", GetArticleByCompanyId);
router.get("/:articleId", GetArticleById);
router.post("/create/:companyId", requireAuth, CreateArticle);
router.put("/:articleId", requireAuth, updateArticle);
router.delete("/:articleid", requireAuth, DeleteArticle);

module.exports = router;
