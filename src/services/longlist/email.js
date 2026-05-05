const fs = require("fs");
const path = require("path");
const os = require("os");
const transporter = require("../../utils/nodemailer");

const FROM = '"TreasuryMap" <noreply@treasurymap.com>';
const FALLBACK_DIR = path.join(os.tmpdir(), "longlist-emails");

function isCredsAvailable() {
  return process.env.G_PASSWORD && process.env.G_PASSWORD !== "local-dev-noop";
}

function bodyText({ companyName }) {
  return `Hello,

Your TreasuryMap Long List report is attached.

This long list was generated based on your answers to the profiling questions${
    companyName ? ` for ${companyName}` : ""
  }, and the providers currently listed in the Treasury Technology Map at www.treasurymap.com.

The report is intended as a starting point for your selection process — we recommend validating each vendor through direct RFI engagement and reference checks before shortlisting.

Best regards,
TreasuryMap

—
www.treasurymap.com
This is an automated message. Please do not reply directly.`;
}

function bodyHtml({ companyName }) {
  return `<p>Hello,</p>
<p>Your <strong>TreasuryMap Long List</strong> report is attached.</p>
<p>This long list was generated based on your answers to the profiling questions${
    companyName ? ` for <strong>${escapeHtml(companyName)}</strong>` : ""
  }, and the providers currently listed in the Treasury Technology Map at <a href="https://www.treasurymap.com">www.treasurymap.com</a>.</p>
<p>The report is intended as a starting point for your selection process — we recommend validating each vendor through direct RFI engagement and reference checks before shortlisting.</p>
<p>Best regards,<br/>TreasuryMap</p>
<hr/>
<p style="color:#888;font-size:11px">www.treasurymap.com — This is an automated message. Please do not reply directly.</p>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Envoie le rapport PDF par email à l'utilisateur.
 * Si les credentials Gmail sont absents (G_PASSWORD=local-dev-noop), tombe en
 * mode "fallback" : sauvegarde l'email dans os.tmpdir()/longlist-emails/ pour
 * permettre de tester le pipeline complet en local sans Gmail réel.
 *
 * @param {object} opts
 * @param {string} opts.to
 * @param {string|null} opts.companyName
 * @param {string} opts.pdfPath - chemin local vers le PDF à attacher
 * @returns {Promise<{sent:boolean, mode:'smtp'|'fallback', messageId?:string, savedTo?:string}>}
 */
async function sendReportEmail({ to, companyName, pdfPath }) {
  if (!to) throw new Error("to manquant");
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    throw new Error(`pdfPath introuvable: ${pdfPath}`);
  }

  const subject = `Your TreasuryMap Long List${companyName ? ` — ${companyName}` : ""}`;
  const message = {
    from: FROM,
    to,
    subject,
    text: bodyText({ companyName }),
    html: bodyHtml({ companyName }),
    attachments: [
      {
        filename: "TreasuryMap-LongList.pdf",
        path: pdfPath,
        contentType: "application/pdf",
      },
    ],
  };

  if (!isCredsAvailable()) {
    return saveFallback({ message, pdfPath });
  }

  try {
    const info = await transporter.sendMail(message);
    return { sent: true, mode: "smtp", messageId: info.messageId };
  } catch (err) {
    // En cas d'échec SMTP, on ne plante pas le pipeline : on sauvegarde
    // l'email en local pour debug et on remonte l'erreur dans le résultat.
    const fallback = saveFallback({ message, pdfPath, error: err.message });
    return { ...fallback, smtpError: err.message };
  }
}

function saveFallback({ message, pdfPath, error }) {
  fs.mkdirSync(FALLBACK_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeTo = String(message.to).replace(/[^a-z0-9@._-]/gi, "_");
  const meta = path.join(FALLBACK_DIR, `${stamp}-${safeTo}.json`);
  const pdfCopy = path.join(FALLBACK_DIR, `${stamp}-${safeTo}.pdf`);
  fs.copyFileSync(pdfPath, pdfCopy);
  fs.writeFileSync(
    meta,
    JSON.stringify(
      {
        when: new Date().toISOString(),
        from: message.from,
        to: message.to,
        subject: message.subject,
        bodyText: message.text,
        attachment: pdfCopy,
        error: error || null,
      },
      null,
      2
    )
  );
  return { sent: false, mode: "fallback", savedTo: meta };
}

module.exports = { sendReportEmail };
