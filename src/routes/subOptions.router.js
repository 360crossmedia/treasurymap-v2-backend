const { Router } = require("express");
const router = Router();
const {
  getAllSubOptions,
  uploadSubOptions,
  getSubOptionsByCompanyId,
  getSingleSubOptionById,
} = require("../controllers/subOptions.controllers");
const { requireAuth } = require("../middlewares/auth.middleware");
const { ownsCompanyByParam } = require("../middlewares/ownership.middleware");

router.get("/", getAllSubOptions);
router.get("/single/:idd", getSingleSubOptionById);
router.get("/:id", getSubOptionsByCompanyId);
router.post("/:companyId", requireAuth, ownsCompanyByParam("companyId"), uploadSubOptions);

module.exports = router;
