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

// TEMP MIGRATION: non-destructive fill-merge from backend A (old admin / current
// map) into this backend B. For each company (matched by name), fills ONLY the
// fields where B is empty/junk and A has a real value. Never overwrites a real B
// value (so B's better data — e.g. Cegid — is preserved). Junk-aware: treats
// "", "N/A", 0 etc. as empty. Also syncs multiplayerMap A->B. Key-guarded.
const Companies = require("../models/companies.models");
const mergeFromA = async (req, res) => {
  if (req.query.key !== "tm-merge-2026") {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    const norm = (s) => (s || "").trim().toLowerCase();
    const arr = (v) => (Array.isArray(v) ? v : []);
    const JUNK = new Set(["", "n/a", "na", "none", "null", "-", "–"]);
    const emptyStr = (v) => v === null || v === undefined || JUNK.has(String(v).trim().toLowerCase());
    const emptyNum = (v) => {
      if (v === null || v === undefined || v === "" || v === 0 || v === "0") return true;
      const n = Number(v);
      return !Number.isNaN(n) && n === 0;
    };
    const STR = ["description", "creationDate", "employees", "location", "companyWebsite", "productName", "productVersion", "logo"];
    const ARR = ["companyOffices", "companyCategories", "companySubcategories", "keywords", "maincategory"];
    const SCOREF = ["description", "turnover", "employees", "location", "companyWebsite", "companyOffices", "companyCategories", "companySubcategories", "productName", "productVersion", "logo", "keywords", "maincategory", "creationDate"];
    const score = (c) => {
      let s = 0;
      for (const f of SCOREF) {
        const v = c[f];
        if (Array.isArray(v)) s += v.length ? 1 : 0;
        else if (v !== null && v !== undefined && v !== "" && v !== 0) s += 1;
      }
      if (c.live && c.logo && arr(c.maincategory).length) s += 3;
      return s;
    };
    const primary = (recs, ref) => {
      let cand = recs;
      if (ref) {
        const rc = new Set(arr(ref.maincategory).map(String));
        const m = recs.filter((c) => rc.size && arr(c.maincategory).map(String).some((x) => rc.has(x)));
        if (m.length) cand = m;
      }
      return cand.reduce((best, c) => (score(c) > score(best) ? c : best), cand[0]);
    };
    const bEmpty = (f, v) => (f === "turnover" ? emptyNum(v) : ARR.includes(f) ? !arr(v).length : emptyStr(v));
    const aReal = (f, v) => (f === "turnover" ? !emptyNum(v) : ARR.includes(f) ? !!arr(v).length : !emptyStr(v));
    const FILL = [...STR, "turnover", ...ARR];

    const r = await fetch("https://treasurymapbackend-production.up.railway.app/api/v1/companies");
    const aList = await r.json();
    const maMap = {};
    for (const c of aList) (maMap[norm(c.name)] = maMap[norm(c.name)] || []).push(c);
    const bAll = await Companies.findAll();
    const mbMap = {};
    for (const c of bAll) (mbMap[norm(c.name)] = mbMap[norm(c.name)] || []).push(c);

    const report = [];
    for (const name of Object.keys(maMap)) {
      if (!mbMap[name]) continue;
      const a = primary(maMap[name]);
      const b = primary(mbMap[name], a);
      const upd = {};
      for (const f of FILL) {
        if (bEmpty(f, b[f]) && aReal(f, a[f])) upd[f] = a[f];
      }
      if (!!a.multiplayerMap !== !!b.multiplayerMap && a.multiplayerMap) upd.multiplayerMap = true;
      if (Object.keys(upd).length) {
        await Companies.update(upd, { where: { id: b.id } });
        report.push({ name: a.name, id: b.id, fields: Object.keys(upd) });
      }
    }
    return res.json({ ok: true, count: report.length, updated: report });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message) });
  }
};

module.exports = {
  mergeFromA,
  getCompanyUserOwn,
  createUserCompany,
  getAllCompanies,
  getCompanyData,
  getCompanyBySlug,
  upadateCompanyData,
  deleteCompany,
  companyHasMediaContent,
};
