const CompaniesServices = require("../services/companies.service");
const UsersServices = require("../services/users.services");
const { slugify } = require("../utils/slugify");

// Columns a company update is allowed to write. Excludes id / timestamps so a
// crafted body can't overwrite the primary key or inject junk columns. The
// admin-gated fields (userId/live/multiplayerMap/clientPackage) stay in the
// list so admins can set them, but the non-admin path strips them from `data`
// before the update, so a vendor still cannot.
const COMPANY_UPDATABLE_FIELDS = [
  "name", "description", "creationDate", "turnover", "employees", "location",
  "userId", "companyWebsite", "companyOffices", "companyCategories",
  "companySubcategories", "maincategory", "productName", "productVersion",
  "logo", "keywords", "live", "showTurnover", "multiplayerMap", "clientPackage",
  "countriesCount",
];

const getCompanyUserOwn = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await CompaniesServices.getOwnedService(userId);
    // No companies for this owner is a valid empty state (e.g. a brand-new
    // vendor), not an error. Always return 200 with an array.
    return res.status(200).json(Array.isArray(result) ? result : []);
  } catch (error) {
    next(error);
  }
};

const createUserCompany = async (req, res, next) => {
  try {
    const data = { ...req.body };
    const isAdmin = Number(req.user && req.user.id) === 1;
    if (!isAdmin) {
      // Vendors can only create their OWN draft listing · never live, never on
      // the multiplayer map, never a paid client. Going live is admin-gated.
      data.userId = req.user.id;
      data.live = false;
      data.multiplayerMap = false;
      data.clientPackage = null;
    }
    const result = await CompaniesServices.createCompanyService(data);
    if (result) {
      res.status(201).json(result);
    } else if (!result) {
      res.status(400).json({ message: "Not created. Controller response" });
    }
  } catch (error) {
    next(error);
  }
};

const getAllCompanies = async (req, res, next) => {
  try {
    const result = await CompaniesServices.getAllCompaniesServices();
    if (!result) {
      return res.status(400).json({ message: "GetAll companies not found" });
    }
    // For an authenticated ADMIN only, attach the owner's email + name so the
    // admin dashboard can contact leads. Never exposed to public/anonymous or
    // non-admin callers (no privacy leak on the public map).
    if (Array.isArray(result) && Number(req.user && req.user.id) === 1) {
      const users = await UsersServices.getAllUsers().catch(() => []);
      const byId = {};
      (Array.isArray(users) ? users : []).forEach((u) => { byId[u.id] = u; });
      const enriched = result.map((c) => {
        const j = typeof c.toJSON === "function" ? c.toJSON() : c;
        const u = byId[j.userId];
        return { ...j, ownerEmail: (u && u.email) || null, ownerName: (u && u.fullName) || null };
      });
      return res.status(200).json(enriched);
    }
    // Public / non-admin callers only ever see LIVE companies. The full table
    // (incl. unpublished drafts) was being exposed to anyone hitting this
    // endpoint directly. Live-only matches what every public surface needs:
    // the homepage map further filters to logo+maincategory, and the providers
    // hub already filters on live. A vendor still sees their own draft via the
    // owner-scoped endpoint, not this list.
    const publicResult = Array.isArray(result)
      ? result.filter((c) => c && c.live)
      : result;
    res.status(200).json(publicResult);
  } catch (error) {
    next(error);
  }
};

const getCompanyData = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const result = await CompaniesServices.getCompanyDataService(companyId);
    if (result) {
      res.status(200).json(result);
    } else if (!result) {
      res.status(400).json({ message: "Company not found" });
    }
  } catch (error) {
    next(error);
  }
};

const upadateCompanyData = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const isAdmin = Number(req.user && req.user.id) === 1;
    let data = req.body;
    if (!isAdmin) {
      // A vendor may only edit their OWN company, and never the admin-gated
      // fields (live / multiplayer / client package / owner).
      const company = await CompaniesServices.getCompanyDataService(companyId);
      if (!company || Number(company.userId) !== Number(req.user && req.user.id)) {
        return res.status(403).json({ message: "Not allowed to edit this company." });
      }
      data = { ...req.body };
      delete data.live;
      delete data.multiplayerMap;
      delete data.clientPackage;
      delete data.userId;
    }
    const result = await CompaniesServices.updateCompanyDataService(
      companyId,
      data,
      COMPANY_UPDATABLE_FIELDS
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const deleteCompany = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const result = await CompaniesServices.deleteCompany(companyId);
    if (result) {
      res.status(200).json({ message: "Company deleted" });
    } else if (!result) {
      res.status(400).json({ message: "Company not found" });
    }
  } catch (error) {
    next(error);
  }
};

const getCompanyBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const all = await CompaniesServices.getAllCompaniesServices();
    if (!Array.isArray(all)) {
      return res.status(404).json({ message: "Company not found" });
    }
    // Public provider page: only LIVE companies are reachable. A draft / unpublished
    // listing must not get a public, indexable page. (live wins on slug collisions.)
    const match = all.find((c) => c.live && slugify(c.name) === slug);
    if (!match) {
      return res.status(404).json({ message: "Company not found" });
    }
    const result = await CompaniesServices.getCompanyDataService(match.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const companyHasMediaContent = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const result = await CompaniesServices.hasRelatedContent(companyId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCompanyUserOwn,
  createUserCompany,
  getAllCompanies,
  getCompanyData,
  getCompanyBySlug,
  upadateCompanyData,
  deleteCompany,
  companyHasMediaContent,
};
