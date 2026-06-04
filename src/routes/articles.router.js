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

router.get("/", GetAllArticles);
router.get("/all/:companyId", GetArticleByCompanyId);
router.get("/:articleId", GetArticleById);
router.post("/create/:companyId", CreateArticle);
router.put("/:articleId", updateArticle);
router.delete("/:articleid", DeleteArticle);

module.exports = router;
