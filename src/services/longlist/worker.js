const fs = require("fs");
const LongListReports = require("../../models/longlistReports.models");
const matching = require("./matching");
const claude = require("./claude");
const pdf = require("./pdf");
const cloudinary = require("./cloudinary");
const email = require("./email");
const appendices = require("./appendices");

// Public URL used by the appendices for deep links back to the TreasuryMap site.
// Override via env in prod; fallback fits local dev.
const SITE_URL = process.env.PUBLIC_SITE_URL || "https://treasurymap-v2-production.up.railway.app";

// Backend base URL for the token-gated PDF download link included in the email
// (used as the online fallback when Cloudinary is not configured).
const API_URL = process.env.PUBLIC_API_URL || "https://treasurymap-v2-back-production.up.railway.app";

// Build the secure online link to a report's PDF (requires its access token).
function pdfDownloadUrl(report) {
  return report.accessToken
    ? `${API_URL}/api/v1/longlist/pdf/${report.id}?t=${report.accessToken}`
    : null;
}

/**
 * Pipeline : matching DB → Claude → PDF → email.
 * Met à jour le statut du LongListReport à chaque étape.
 * Ne throw jamais : les erreurs sont loggées en DB (status=failed, error_message).
 *
 * @param {number} reportId
 * @returns {Promise<{ok:boolean, reportId:number, status:string}>}
 */
async function processReport(reportId) {
  const report = await LongListReports.findByPk(reportId);
  if (!report) {
    console.error(`[longlist worker] report ${reportId} introuvable`);
    return { ok: false, reportId, status: "missing" };
  }

  // Route les comparaisons vers leur pipeline dédié · short-circuit ici.
  if (report.reportType === "comparison") {
    return processComparison(report);
  }

  try {
    await report.update({ status: "generating" });

    // 1. Matching providers depuis la DB
    const shortlist = await matching.getProvidersForCategories(report.categoryIds);

    // 2. Claude génère le markdown
    const result = await claude.generateReport({
      answers: report.answers,
      shortlist,
    });

    // 2b. Appendices déterministes : Vendor Directory + Further Reading
    // Construits en local depuis la DB pour éviter les hallucinations Claude
    // sur les URLs et garantir des liens cliquables vers le site.
    const vendorDirectoryMd = appendices.buildVendorDirectory(shortlist, SITE_URL);
    const furtherReadingMd = await appendices.buildFurtherReading(
      report.categoryIds,
      SITE_URL
    );
    const fullMarkdown = [result.markdown, vendorDirectoryMd, furtherReadingMd]
      .filter(Boolean)
      .join("\n\n");

    await report.update({
      reportMd: fullMarkdown,
      modelUsed: result.model,
      inputTokens: result.usage?.input_tokens || null,
      outputTokens: result.usage?.output_tokens || null,
      generationMs: result.generationMs,
    });

    // 3. PDF (toujours sur disque local · utilisé pour la pièce jointe email)
    const pdfResult = await pdf.renderPdf({
      markdown: fullMarkdown,
      title: `TreasuryMap Long List${report.companyName ? ` · ${report.companyName}` : ""}`,
      fileName: `longlist-${report.id}.pdf`,
    });

    // 4. Upload Cloudinary pour persistance long-terme (URL stockée en DB)
    // En l'absence de creds, fallback silencieux sur le path local.
    const cloudResult = await cloudinary.uploadPdf(pdfResult.path, { reportId: report.id });
    const persistedPath = cloudResult.ok ? cloudResult.url : pdfResult.path;
    // Always persist the PDF bytes in the DB so the download endpoint works even
    // after a container restart and without Cloudinary.
    let pdfData = null;
    try { pdfData = fs.readFileSync(pdfResult.path).toString("base64"); } catch (_) {}
    await report.update({ pdfPath: persistedPath, pdfData });

    // 5. Email · pièce jointe (locale) + lien (Cloudinary si dispo, fallback local)
    const emailResult = await email.sendReportEmail({
      to: report.email,
      companyName: report.companyName,
      pdfPath: pdfResult.path,
      pdfUrl: cloudResult.ok ? cloudResult.url : pdfDownloadUrl(report),
    });

    // Only mark "sent" if the email actually went out. A failed send must not
    // tell the visitor to check an inbox that will never receive anything.
    await report.update({
      status: emailResult.sent ? "sent" : "failed",
      emailedAt: emailResult.sent ? new Date() : null,
    });

    console.log(
      `[longlist worker] report ${reportId} OK (email=${emailResult.mode}, ` +
        `cloud=${cloudResult.mode}, tokens=${result.usage?.input_tokens || 0}/${result.usage?.output_tokens || 0}, ` +
        `gen=${result.generationMs}ms, pdf=${(pdfResult.sizeBytes / 1024).toFixed(0)}KB)`
    );
    return { ok: true, reportId, status: "sent", emailMode: emailResult.mode };
  } catch (err) {
    // Stack tronquée pour ne pas inonder les logs en cas d'erreur SDK profonde
    const stack = err.stack ? err.stack.split("\n").slice(0, 6).join("\n") : "(no stack)";
    console.error(
      `[longlist worker] report ${reportId} FAILED: ${err.message}\n${stack}`
    );
    await report
      .update({
        status: "failed",
        errorMessage: String(err.message).slice(0, 2000),
      })
      .catch((e) =>
        console.error(`[longlist worker] update failed status itself failed:`, e.message)
      );
    return { ok: false, reportId, status: "failed", error: err.message };
  }
}

/**
 * Pipeline comparison : matching vendors par IDs → Claude (compare prompt)
 * → PDF → email. Même structure que processReport mais entrée différente
 * (un seul categoryId + liste vendorIds).
 */
async function processComparison(report) {
  try {
    await report.update({ status: "generating" });

    const categoryId = report.categoryIds[0];
    const { vendors, missingIds, wrongCatIds } = await matching.getVendorsByIdsInCategory(
      report.vendorIds,
      categoryId
    );
    if (vendors.length < 2) {
      throw new Error(
        `Pas assez de vendors valides pour comparer (got=${vendors.length}, missing=${missingIds}, wrong-category=${wrongCatIds})`
      );
    }
    const [cat] = await matching.getCategoriesByIds([categoryId]);
    const categoryName = cat?.name || `Category ${categoryId}`;

    // Claude génère la comparaison
    const result = await claude.generateComparison({
      categoryName,
      vendors,
      context: report.answers?.context || "",
    });

    // Appendices : Vendor Directory restreint aux vendors comparés
    const vendorDirectoryMd = appendices.buildVendorDirectory(
      [{ categoryId, categoryName, providers: vendors }],
      SITE_URL
    );
    const furtherReadingMd = await appendices.buildFurtherReading(
      [categoryId],
      SITE_URL
    );
    const fullMarkdown = [result.markdown, vendorDirectoryMd, furtherReadingMd]
      .filter(Boolean)
      .join("\n\n");

    await report.update({
      reportMd: fullMarkdown,
      modelUsed: result.model,
      inputTokens: result.usage?.input_tokens || null,
      outputTokens: result.usage?.output_tokens || null,
      generationMs: result.generationMs,
    });

    const pdfResult = await pdf.renderPdf({
      markdown: fullMarkdown,
      title: `TreasuryMap Vendor Comparison${report.companyName ? ` · ${report.companyName}` : ""}`,
      fileName: `compare-${report.id}.pdf`,
    });

    const cloudResult = await cloudinary.uploadPdf(pdfResult.path, {
      reportId: report.id,
    });
    const persistedPath = cloudResult.ok ? cloudResult.url : pdfResult.path;
    let pdfData = null;
    try { pdfData = fs.readFileSync(pdfResult.path).toString("base64"); } catch (_) {}
    await report.update({ pdfPath: persistedPath, pdfData });

    const emailResult = await email.sendReportEmail({
      to: report.email,
      companyName: report.companyName,
      pdfPath: pdfResult.path,
      pdfUrl: cloudResult.ok ? cloudResult.url : pdfDownloadUrl(report),
    });

    await report.update({
      status: emailResult.sent ? "sent" : "failed",
      emailedAt: emailResult.sent ? new Date() : null,
    });

    console.log(
      `[compare worker] report ${report.id} OK (vendors=${vendors.length}, email=${emailResult.mode}, ` +
        `tokens=${result.usage?.input_tokens || 0}/${result.usage?.output_tokens || 0}, ` +
        `gen=${result.generationMs}ms, pdf=${(pdfResult.sizeBytes / 1024).toFixed(0)}KB)`
    );
    return { ok: true, reportId: report.id, status: "sent", emailMode: emailResult.mode };
  } catch (err) {
    const stack = err.stack ? err.stack.split("\n").slice(0, 6).join("\n") : "(no stack)";
    console.error(`[compare worker] report ${report.id} FAILED: ${err.message}\n${stack}`);
    await report
      .update({
        status: "failed",
        errorMessage: String(err.message).slice(0, 2000),
      })
      .catch((e) =>
        console.error(`[compare worker] update failed status itself failed:`, e.message)
      );
    return { ok: false, reportId: report.id, status: "failed", error: err.message };
  }
}

/**
 * Lance le worker en arrière-plan, sans attendre. Utile pour répondre 202
 * immédiatement à l'utilisateur sans bloquer la requête HTTP.
 */
function enqueue(reportId) {
  setImmediate(() => {
    processReport(reportId).catch((err) =>
      console.error(`[longlist worker] uncaught for ${reportId}:`, err)
    );
  });
}

module.exports = { processReport, processComparison, enqueue };
