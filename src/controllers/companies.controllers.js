const CompaniesServices = require("../services/companies.service");
const { slugify } = require("../utils/slugify");

const getCompanyUserOwn = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await CompaniesServices.getOwnedService(userId);
    if (result) {
      res.status(200).json(result);
    } else if (!result) {
      res
        .status(400)
        .json({ message: "Not companies found. Controller response" });
    }
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
    if (result) {
      res.status(200).json(result);
    } else if (!result) {
      res.status(400).json({ message: "GetAll companies not found" });
    }
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
    const result = await CompaniesServices.updateCompanyDataService(companyId, data);
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
    const match = all.find((c) => slugify(c.name) === slug);
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
