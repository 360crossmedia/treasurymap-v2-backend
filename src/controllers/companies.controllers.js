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

// TEMP MIGRATION: sync `live` from backend A (old admin) -> this backend (B).
// Only flips B records that already have logo + maincategory and are not live,
// for company names that are map-eligible on A. Picks the duplicate whose
// maincategory matches A's. Key-guarded. Remove after running.
const Companies = require("../models/companies.models");
const syncLiveFromA = async (req, res) => {
  if (req.query.key !== "tm-sync-live-2026") {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    const norm = (s) => (s || "").trim().toLowerCase();
    const arr = (v) => (Array.isArray(v) ? v : []);
    const r = await fetch(
      "https://treasurymapbackend-production.up.railway.app/api/v1/companies"
    );
    const aList = await r.json();
    // eligible names on A -> set of their maincategory codes
    const eligA = new Map();
    for (const c of aList) {
      if (c.live && c.logo && arr(c.maincategory).length) {
        const k = norm(c.name);
        const set = eligA.get(k) || new Set();
        arr(c.maincategory).forEach((m) => set.add(String(m)));
        eligA.set(k, set);
      }
    }
    const bList = await Companies.findAll();
    const fixed = [];
    for (const [name, aCats] of eligA) {
      const matches = bList.filter(
        (c) => norm(c.name) === name && c.logo && arr(c.maincategory).length
      );
      if (!matches.length) continue;
      if (matches.some((c) => c.live)) continue; // already eligible on B
      // prefer the duplicate whose maincategory matches A's
      let target =
        matches.find((c) =>
          arr(c.maincategory).some((m) => aCats.has(String(m)))
        ) || matches[0];
      await Companies.update({ live: true }, { where: { id: target.id } });
      fixed.push({ name: target.name, id: target.id, maincat: target.maincategory });
    }
    return res.json({ ok: true, count: fixed.length, fixed });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message) });
  }
};

module.exports = {
  syncLiveFromA,
  getCompanyUserOwn,
  createUserCompany,
  getAllCompanies,
  getCompanyData,
  getCompanyBySlug,
  upadateCompanyData,
  deleteCompany,
  companyHasMediaContent,
};
