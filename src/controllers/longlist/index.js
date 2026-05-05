const LongListReports = require("../../models/longlistReports.models");
const worker = require("../../services/longlist/worker");
const matching = require("../../services/longlist/matching");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Limites payload — protège la DB et le coût Claude (chaque génération ≈ $0.20)
const MAX_EMAIL_LEN = 254;
const MAX_COMPANY_LEN = 200;
const MAX_ANSWERS_BYTES = 50_000;
const MAX_ANSWER_KEYS = 30;
const MAX_ANSWER_VALUE_LEN = 5_000;
const MAX_CATEGORY_IDS = 14;
const CATEGORY_ID_MIN = 1;
const CATEGORY_ID_MAX = 1_000;

function validatePayload({ email, companyName, answers, categoryIds }) {
  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return "Email invalide ou manquant";
  }
  if (email.length > MAX_EMAIL_LEN) return "Email trop long";

  if (companyName != null) {
    if (typeof companyName !== "string") return "companyName doit être une chaîne";
    if (companyName.length > MAX_COMPANY_LEN) return "companyName trop long";
  }

  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return "Answers manquant ou invalide";
  }
  const keys = Object.keys(answers);
  if (keys.length === 0) return "Answers vide";
  if (keys.length > MAX_ANSWER_KEYS) return `Answers trop nombreuses (max ${MAX_ANSWER_KEYS})`;
  for (const k of keys) {
    const v = answers[k];
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item !== "string" && typeof item !== "number" && typeof item !== "boolean") {
          return `Answer "${k}" : type invalide dans le tableau`;
        }
        if (typeof item === "string" && item.length > MAX_ANSWER_VALUE_LEN) {
          return `Answer "${k}" : valeur trop longue`;
        }
      }
    } else if (typeof v === "string") {
      if (v.length > MAX_ANSWER_VALUE_LEN) return `Answer "${k}" : valeur trop longue`;
    } else if (typeof v !== "number" && typeof v !== "boolean") {
      return `Answer "${k}" : type invalide`;
    }
  }
  let serialized;
  try {
    serialized = JSON.stringify(answers);
  } catch {
    return "Answers non sérialisable";
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_ANSWERS_BYTES) {
    return `Answers trop volumineuses (max ${MAX_ANSWERS_BYTES} bytes JSON)`;
  }

  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    return "Au moins une catégorie doit être sélectionnée";
  }
  if (categoryIds.length > MAX_CATEGORY_IDS) {
    return `Trop de catégories (max ${MAX_CATEGORY_IDS})`;
  }
  for (const id of categoryIds) {
    if (!Number.isInteger(id) || id < CATEGORY_ID_MIN || id > CATEGORY_ID_MAX) {
      return `categoryId invalide : ${id}`;
    }
  }
  if (new Set(categoryIds).size !== categoryIds.length) {
    return "categoryIds contient des doublons";
  }

  return null;
}

const generate = async (req, res, next) => {
  try {
    const { email, companyName, answers, categoryIds, website } = req.body || {};

    // Honeypot : champ "website" caché côté front. Si rempli, c'est un bot.
    // On répond 202 fake (le bot pense que ça a marché) sans rien faire — pas
    // de DB, pas de Claude, pas de coût. On log pour stats.
    if (website && String(website).trim().length > 0) {
      console.log(
        `[longlist] honeypot triggered (email=${String(email).slice(0, 50)}, ip=${req.ip}, website="${String(website).slice(0, 50)}")`
      );
      return res.status(202).json({
        id: 0,
        status: "pending",
        message:
          "Votre rapport est en cours de génération. Vous le recevrez par email dans quelques minutes.",
      });
    }

    const validationError = validatePayload({ email, companyName, answers, categoryIds });
    if (validationError) {
      return res.status(400).json({ error: validationError });
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
    if (!/^\d+$/.test(String(id))) return res.status(400).json({ error: "id invalide" });
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

module.exports = { generate, getStatus, listCategories, validatePayload };
