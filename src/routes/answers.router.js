const { Router } = require("express");
const router = Router();
const {
  CreateAnswer,
  GetAnswerByCompanyId,
  updateAnswer,
  deleteAllAnswersByCompanyId,
} = require("../controllers/answers.controllers");
const { requireAuth } = require("../middlewares/auth.middleware");

router.get("/:companyId", GetAnswerByCompanyId);
router.post("/:companyId", requireAuth, CreateAnswer);
router.put("/:answerId", requireAuth, updateAnswer);
router.delete("/:companyId", requireAuth, deleteAllAnswersByCompanyId);

module.exports = router;
