const CompaniesServices = require("../services/companies.service");
const { slugify } = require("../utils/slugify");
const Companies = require("../models/companies.models");
const Users = require("../models/user.models");

// One-time data fix: every company was migrated under a single owner (#11).
// Reassign each company to the user whose name matches the company; otherwise
// to the master admin (#1). Guarded by a key; remove after running.
const fixOwners = async (req, res) => {
  if (req.query.key !== "tm-fix-owners-2026") {
    return res.status(403).json({ message: "forbidden" });
  }
  try {
    const norm = (s) => (s || "").trim().toLowerCase();
    const companies = await Companies.findAll();
    const users = await Users.findAll();
    const byName = {};
    for (const u of users) {
      const k = norm(u.fullName);
      if (k && !(k in byName)) byName[k] = u.id;
    }
    let toVendor = 0, toAdmin = 0, unchanged = 0;
    for (const c of companies) {
      const target = byName[norm(c.name)] != null ? byName[norm(c.name)] : 1;
      if (c.userId === target) { unchanged++; continue; }
      await Companies.update({ userId: target }, { where: { id: c.id } });
      target === 1 ? toAdmin++ : toVendor++;
    }
    res.json({ ok: true, total: companies.length, reassignedToVendor: toVendor, reassignedToAdmin: toAdmin, unchanged });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};

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
    const data = req.body;
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
    const result = await CompaniesServices.updateCompanyDataService(
      companyId,
      req.body
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
  fixOwners,
};
