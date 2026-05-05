const LongListReports = require("../../models/longlistReports.models");
const worker = require("../../services/longlist/worker");
const matching = require("../../services/longlist/matching");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_CATEGORY_KEYS = [
  "TRMS",
  "BSG",
  "CMA",
  "CFF",
  "FIDP",
  "FIDM",
  "OTS",
  "Integrators",
];

const generate = async (req, res, next) => {
  try {
    const { email, companyName, answers, categoryIds } = req.body || {};

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Email invalide ou manquant" });
    }
    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ error: "Answers manquant ou invalide" });
    }
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res
        .status(400)
        .json({ error: "Au moins une catégorie doit être sélectionnée" });
    }

    const report = await LongListReports.create({
      email,
      companyName: companyName || null,
      answers,
      categoryIds,
      status: "pending",
    });

    worker.enqueue(report.id);

    res.status(202).json({
      id: report.id,
      status: report.status,
      message:
        "Votre rapport est en cours de génération. Vous le recevrez par email dans quelques minutes.",
    });
  } catch (err) {
    next(err);
  }
};

const getStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await LongListReports.findByPk(id, {
      attributes: ["id", "status", "emailedAt", "errorMessage", "createdAt"],
    });
    if (!report) return res.status(404).json({ error: "Report introuvable" });
    res.json(report);
  } catch (err) {
    next(err);
  }
};

const listCategories = async (req, res, next) => {
  try {
    const cats = await matching.getAllCategories();
    res.json({ categories: cats });
  } catch (err) {
    next(err);
  }
};

module.exports = { generate, getStatus, listCategories, VALID_CATEGORY_KEYS };
