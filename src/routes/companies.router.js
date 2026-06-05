const { Router } = require("express");
const router = Router();
const {
  getCompanyUserOwn,
  createUserCompany,
  getCompanyData,
  getCompanyBySlug,
  upadateCompanyData,
  deleteCompany,
  getAllCompanies,
  companyHasMediaContent,
} = require("../controllers/companies.controllers");
const { requireAuth, requireAdmin, optionalAuth } = require("../middlewares/auth.middleware");

router.get("/", optionalAuth, getAllCompanies);
router.get("/by-slug/:slug", getCompanyBySlug);
router.get("/:companyId", getCompanyData);
router.get("/getByOwner/:userId", getCompanyUserOwn);
router.get("/hasMedia/:companyId", companyHasMediaContent);
router.post("/create", requireAuth, createUserCompany);
router.put("/:companyId", requireAuth, upadateCompanyData);
router.delete("/:companyId", requireAdmin, deleteCompany);

module.exports = router;
