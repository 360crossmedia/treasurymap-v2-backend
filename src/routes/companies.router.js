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
  listCompanyAdmins,
  addCompanyAdmin,
  removeCompanyAdmin,
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

// Extra admins for a company (admin only). More specific (2+ segments) than the
// routes above, so they never collide with "/:companyId".
router.get("/:companyId/admins", requireAdmin, listCompanyAdmins);
router.post("/:companyId/admins", requireAdmin, addCompanyAdmin);
router.delete("/:companyId/admins/:userId", requireAdmin, removeCompanyAdmin);

module.exports = router;
