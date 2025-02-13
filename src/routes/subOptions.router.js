const { Router } = require("express");
const router = Router();
const {
  getAllSubOptions,
  uploadSubOptions,
  getSubOptionsByCompanyId,
  getSingleSubOptionById,
} = require("../controllers/subOptions.controllers");

router.get("/", getAllSubOptions);
router.get("/single/:idd", getSingleSubOptionById);
router.get("/:id", getSubOptionsByCompanyId);
router.post("/:companyId", uploadSubOptions);

module.exports = router;
