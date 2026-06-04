const { Router } = require("express");
const router = Router();
const {
  getAllSubOptions,
  uploadSubOptions,
  getSubOptionsByCompanyId,
  getSingleSubOptionById,
} = require("../controllers/subOptions.controllers");
const { requireAuth } = require("../middlewares/auth.middleware");

router.get("/", getAllSubOptions);
router.get("/single/:idd", getSingleSubOptionById);
router.get("/:id", getSubOptionsByCompanyId);
router.post("/:companyId", requireAuth, uploadSubOptions);

module.exports = router;
