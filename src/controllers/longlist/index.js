const LongListReports = require("../../models/longlistReports.models");
const worker = require("../../services/longlist/worker");
const matching = require("../../services/longlist/matching");
const fs = require("fs");
const path = require("path");
const os = require("os");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Limites payload · protège la DB et le coût Claude (chaque génération ≈ $0.20)
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
    // On répond 202 fake (le bot pense que ça a marché) sans rien faire · pas
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
      attributes: ["id", "status", "emailedAt", "errorMessage", "createdAt", "pdfPath"],
    });
    if (!report) return res.status(404).json({ error: "Report introuvable" });
    // pdfReady lets the front show a guaranteed Download button.
    const pdfReady = report.status === "sent" || !!report.pdfPath;
    res.json({ ...report.toJSON(), pdfReady });
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

// Liste des vendors d'une catégorie donnée · utilisé par le form Compare Tools
// (étape 2 : après que l'user a choisi sa catégorie, on lui propose les vendors).
const listVendorsForCategory = async (req, res, next) => {
  try {
    const cid = parseInt(req.params.categoryId, 10);
    if (!Number.isInteger(cid) || cid < CATEGORY_ID_MIN || cid > CATEGORY_ID_MAX) {
      return res.status(400).json({ error: "categoryId invalide" });
    }
    const result = await matching.getProvidersForSingleCategory(cid);
    res.json({
      categoryId: result.categoryId,
      categoryName: result.categoryName,
      vendors: result.providers.map((p) => ({
        id: p.id,
        name: p.name,
        logo: p.logo,
        productName: p.productName,
        website: p.website,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// Validation spécifique au pipeline Compare.
function validateComparisonPayload({ email, companyName, categoryId, vendorIds, context }) {
  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email))
    return "Email invalide ou manquant";
  if (email.length > MAX_EMAIL_LEN) return "Email trop long";

  if (companyName != null) {
    if (typeof companyName !== "string") return "companyName doit être une chaîne";
    if (companyName.length > MAX_COMPANY_LEN) return "companyName trop long";
  }

  if (!Number.isInteger(categoryId) || categoryId < CATEGORY_ID_MIN || categoryId > CATEGORY_ID_MAX)
    return "categoryId invalide";

  if (!Array.isArray(vendorIds) || vendorIds.length < 2 || vendorIds.length > 5)
    return "Choisir entre 2 et 5 vendors à comparer";
  for (const id of vendorIds) {
    if (!Number.isInteger(id) || id <= 0) return `vendorId invalide : ${id}`;
  }
  if (new Set(vendorIds).size !== vendorIds.length) return "vendorIds contient des doublons";

  if (context != null) {
    if (typeof context !== "string") return "context doit être une chaîne";
    if (context.length > 2000) return "context trop long (max 2000 chars)";
  }

  return null;
}

const generateComparison = async (req, res, next) => {
  try {
    const { email, companyName, categoryId, vendorIds, context, website } = req.body || {};

    // Honeypot
    if (website && String(website).trim().length > 0) {
      console.log(
        `[compare] honeypot triggered (email=${String(email).slice(0, 50)}, ip=${req.ip})`
      );
      return res.status(202).json({
        id: 0,
        status: "pending",
        message:
          "Votre comparaison est en cours de génération. Vous la recevrez par email dans quelques minutes.",
      });
    }

    const err = validateComparisonPayload({ email, companyName, categoryId, vendorIds, context });
    if (err) return res.status(400).json({ error: err });

    // Sanity check : que les vendors soient bien dans cette catégorie
    const { vendors, missingIds, wrongCatIds } = await matching.getVendorsByIdsInCategory(
      vendorIds,
      categoryId
    );
    if (vendors.length < 2) {
      return res.status(400).json({
        error: "Vendors invalides ou hors catégorie",
        details: { found: vendors.length, missing: missingIds, wrongCategory: wrongCatIds },
      });
    }

    const report = await LongListReports.create({
      email,
      companyName: companyName || null,
      reportType: "comparison",
      categoryIds: [categoryId],
      vendorIds,
      answers: { context: context || "" },
      status: "pending",
    });

    worker.enqueue(report.id);

    res.status(202).json({
      id: report.id,
      status: report.status,
      message:
        "Votre comparaison est en cours de génération. Vous la recevrez par email dans quelques minutes.",
    });
  } catch (e) {
    next(e);
  }
};

// Serve the generated PDF directly · fallback when Cloudinary is not configured.
// The file lives at /tmp/longlist-pdfs/longlist-{id}.pdf on the Railway container.
// Note: ephemeral storage · file disappears on container restart.
async function downloadPdf(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const report = await LongListReports.findByPk(id);
  if (!report) return res.status(404).json({ error: "Report not found" });

  const type = report.reportType === "compare" ? "compare" : "longlist";

  // 1) Preferred: the PDF kept in the DB · always available, survives restarts
  //    and needs no Cloudinary.
  if (report.pdfData) {
    const buf = Buffer.from(report.pdfData, "base64");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="TreasuryMap-${type}-${id}.pdf"`);
    return res.send(buf);
  }

  // 2) If pdf_path is a Cloudinary URL, redirect to it.
  if (report.pdfPath && report.pdfPath.startsWith("http")) {
    return res.redirect(302, report.pdfPath);
  }

  // 3) Last resort: local /tmp path (only valid before a container restart).
  const localPath = report.pdfPath ||
    path.join(os.tmpdir(), "longlist-pdfs", `longlist-${id}.pdf`);

  if (!fs.existsSync(localPath)) {
    return res.status(404).json({
      error: "PDF not found on disk (container may have restarted). Please regenerate.",
    });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="TreasuryMap-${type}-${id}.pdf"`);
  fs.createReadStream(localPath).pipe(res);
}

module.exports = {
  generate,
  getStatus,
  listCategories,
  listVendorsForCategory,
  generateComparison,
  downloadPdf,
  validatePayload,
  validateComparisonPayload,
};
