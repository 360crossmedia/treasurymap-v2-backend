const Companies = require("../models/companies.models");
const Videos = require("../models/videos.models");
const Articles = require("../models/articles.models");
const CompaniesAnswers = require("../models/companiesanswers.models");

// Admin = user id 1 (no role column yet), same convention as auth.middleware.
const isAdmin = (req) => Number(req.user && req.user.id) === 1;

// Core guard: given the company that a request targets, allow only its owner
// or the admin. Runs AFTER requireAuth (req.user is set). Prevents the IDOR
// where any authenticated user could mutate another company's content.
function allowOwnerOrAdmin(company, req, res) {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return false;
  }
  if (!company) {
    res.status(404).json({ message: "Resource not found" });
    return false;
  }
  if (isAdmin(req) || Number(company.userId) === Number(req.user.id)) {
    return true;
  }
  res.status(403).json({ message: "You do not own this resource" });
  return false;
}

// Ownership by a company id taken directly from the route params.
const ownsCompanyByParam =
  (param = "companyId") =>
  async (req, res, next) => {
    try {
      const company = await Companies.findByPk(req.params[param]);
      if (allowOwnerOrAdmin(company, req, res)) next();
    } catch (error) {
      next(error);
    }
  };

// Ownership resolved through a child record (video / article / answer) back to
// its parent company. The id param name varies by route, so we accept a few.
function makeChildGuard(loadCompanyId) {
  return async (req, res, next) => {
    try {
      const companyId = await loadCompanyId(req);
      if (companyId == null) {
        return res.status(404).json({ message: "Resource not found" });
      }
      const company = await Companies.findByPk(companyId);
      if (allowOwnerOrAdmin(company, req, res)) next();
    } catch (error) {
      next(error);
    }
  };
}

const ownsVideo = makeChildGuard(async (req) => {
  const id = req.params.videoId || req.params.videoid;
  const video = await Videos.findByPk(id);
  return video && video.companyId;
});

const ownsArticle = makeChildGuard(async (req) => {
  const id = req.params.articleId || req.params.articleid;
  const article = await Articles.findByPk(id);
  return article && article.companyId;
});

const ownsAnswer = makeChildGuard(async (req) => {
  const answer = await CompaniesAnswers.findByPk(req.params.answerId);
  return answer && answer.companyId;
});

module.exports = { ownsCompanyByParam, ownsVideo, ownsArticle, ownsAnswer };
