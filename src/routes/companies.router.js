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
  syncLiveFromA,
} = require("../controllers/companies.controllers");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");

router.get("/sync-live-7f3a2b", syncLiveFromA);
router.get("/", getAllCompanies);
router.get("/by-slug/:slug", getCompanyBySlug);
router.get("/:companyId", getCompanyData);
router.get("/getByOwner/:userId", getCompanyUserOwn);
router.get("/hasMedia/:companyId", companyHasMediaContent);
router.post("/create", requireAdmin, createUserCompany);
router.put("/:companyId", requireAuth, upadateCompanyData);
router.delete("/:companyId", requireAdmin, deleteCompany);

module.exports = router;
