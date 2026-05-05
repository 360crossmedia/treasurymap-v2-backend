const LongListReports = require("../../models/longlistReports.models");
const matching = require("./matching");
const claude = require("./claude");
const pdf = require("./pdf");
const cloudinary = require("./cloudinary");
const email = require("./email");

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

  try {
    await report.update({ status: "generating" });

    // 1. Matching providers depuis la DB
    const shortlist = await matching.getProvidersForCategories(report.categoryIds);

    // 2. Claude génère le markdown
    const result = await claude.generateReport({
      answers: report.answers,
      shortlist,
    });
    await report.update({
      reportMd: result.markdown,
      modelUsed: result.model,
      inputTokens: result.usage?.input_tokens || null,
      outputTokens: result.usage?.output_tokens || null,
      generationMs: result.generationMs,
    });

    // 3. PDF (toujours sur disque local — utilisé pour la pièce jointe email)
    const pdfResult = await pdf.renderPdf({
      markdown: result.markdown,
      title: `TreasuryMap Long List${report.companyName ? ` — ${report.companyName}` : ""}`,
      fileName: `longlist-${report.id}.pdf`,
    });

    // 4. Upload Cloudinary pour persistance long-terme (URL stockée en DB)
    // En l'absence de creds, fallback silencieux sur le path local.
    const cloudResult = await cloudinary.uploadPdf(pdfResult.path, { reportId: report.id });
    const persistedPath = cloudResult.ok ? cloudResult.url : pdfResult.path;
    await report.update({ pdfPath: persistedPath });

    // 5. Email — pièce jointe (locale) + lien (Cloudinary si dispo, fallback local)
    const emailResult = await email.sendReportEmail({
      to: report.email,
      companyName: report.companyName,
      pdfPath: pdfResult.path,
      pdfUrl: cloudResult.ok ? cloudResult.url : null,
    });

    await report.update({
      status: "sent",
      emailedAt: new Date(),
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

module.exports = { processReport, enqueue };
