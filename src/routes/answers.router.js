const { Router } = require("express");
const router = Router();
const {
  CreateAnswer,
  GetAnswerByCompanyId,
  updateAnswer,
  deleteAllAnswersByCompanyId,
} = require("../controllers/answers.controllers");
const { requireAuth } = require("../middlewares/auth.middleware");
const {
  ownsCompanyByParam,
  ownsAnswer,
} = require("../middlewares/ownership.middleware");

router.get("/:companyId", GetAnswerByCompanyId);
router.post("/:companyId", requireAuth, ownsCompanyByParam("companyId"), CreateAnswer);
router.put("/:answerId", requireAuth, ownsAnswer, updateAnswer);
router.delete("/:companyId", requireAuth, ownsCompanyByParam("companyId"), deleteAllAnswersByCompanyId);

module.exports = router;
