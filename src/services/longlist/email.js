// Email delivery via Resend (https://resend.com).
//
// Behaviour:
//  - If RESEND_API_KEY is set → real send via Resend HTTP API.
//  - Otherwise → fallback file (PDF + JSON metadata) in os.tmpdir()/longlist-emails/
//    so the pipeline can be tested locally without a Resend account.
//
// FROM address comes from EMAIL_FROM env var; we default to the Resend sandbox
// "TreasuryMap <onboarding@resend.dev>" which works out-of-the-box but is limited
// to the Resend account owner's email as recipient. To send to arbitrary
// recipients, a verified domain must be set up on Resend and EMAIL_FROM updated
// (e.g. "TreasuryMap <reports@treasurymap.360crossmedia.com>").

const fs = require("fs");
const path = require("path");
const os = require("os");
const { Resend } = require("resend");

const FROM = process.env.EMAIL_FROM || "TreasuryMap <onboarding@resend.dev>";
const FALLBACK_DIR = path.join(os.tmpdir(), "longlist-emails");

// Until a domain is verified on Resend, the sandbox FROM (onboarding@resend.dev)
// can only deliver to the account owner. So while we're on the sandbox we route
// every shortlist to the internal inbox (the team always receives it, with the
// requester as reply-to). Once EMAIL_FROM is a verified-domain address, this
// flips automatically to delivering straight to the visitor.
const INTERNAL_INBOX = process.env.INTERNAL_INBOX || "relations@360crossmedia.com";
const ON_SANDBOX = /onboarding@resend\.dev/i.test(FROM);

let _resend = null;
function resendClient() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY manquante dans l'env");
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

function isCredsAvailable() {
  return !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "local-dev-noop";
}

function bodyText({ companyName, pdfUrl }) {
  return `Hello,

Your TreasuryMap Long List report is attached.${
    pdfUrl ? `\n\nYou can also access the report online here:\n${pdfUrl}` : ""
  }

This long list was generated based on your answers to the profiling questions${
    companyName ? ` for ${companyName}` : ""
  }, and the providers currently listed in the Treasury Technology Map at www.treasurymap.com.

The report is intended as a starting point for your selection process · we recommend validating each vendor through direct RFI engagement and reference checks before shortlisting.

Best regards,
TreasuryMap

www.treasurymap.com
This is an automated message. Please do not reply directly.`;
}

function bodyHtml({ companyName, pdfUrl }) {
  return `<p>Hello,</p>
<p>Your <strong>TreasuryMap Long List</strong> report is attached.</p>
${
  pdfUrl
    ? `<p>You can also <a href="${escapeHtml(pdfUrl)}" style="color:#2f6fe0;font-weight:600">access the report online</a>.</p>`
    : ""
}
<p>This long list was generated based on your answers to the profiling questions${
    companyName ? ` for <strong>${escapeHtml(companyName)}</strong>` : ""
  }, and the providers currently listed in the Treasury Technology Map at <a href="https://www.treasurymap.com">www.treasurymap.com</a>.</p>
<p>The report is intended as a starting point for your selection process · we recommend validating each vendor through direct RFI engagement and reference checks before shortlisting.</p>
<p>Best regards,<br/>TreasuryMap</p>
<hr/>
<p style="color:#888;font-size:11px">www.treasurymap.com · This is an automated message. Please do not reply directly.</p>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Envoie le rapport PDF par email à l'utilisateur via Resend.
 * Si RESEND_API_KEY est absent, sauvegarde l'email en local pour debug
 * (pipeline testable sans compte Resend).
 *
 * @param {object} opts
 * @param {string} opts.to
 * @param {string|null} opts.companyName
 * @param {string} opts.pdfPath - chemin local vers le PDF à attacher
 * @param {string|null} [opts.pdfUrl] - URL Cloudinary si dispo
 * @returns {Promise<{sent:boolean, mode:'resend'|'fallback', messageId?:string, savedTo?:string, smtpError?:string}>}
 */
async function sendReportEmail({ to, companyName, pdfPath, pdfUrl = null }) {
  if (!to) throw new Error("to manquant");
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    throw new Error(`pdfPath introuvable: ${pdfPath}`);
  }

  const pdfBuffer = fs.readFileSync(pdfPath);

  // On the sandbox: deliver to the team inbox, tag the subject/body with the
  // requester, and set them as reply-to. Once a domain is verified, deliver
  // straight to the visitor.
  const recipient = ON_SANDBOX ? INTERNAL_INBOX : to;
  const requester = ON_SANDBOX ? to : null;
  const subject =
    `Your TreasuryMap shortlist${companyName ? ` · ${companyName}` : ""}` +
    (requester ? ` (requested by ${requester})` : "");

  const message = {
    from: FROM,
    to: recipient,
    replyTo: to,
    subject,
    text:
      (requester ? `Requested by: ${requester}\n\n` : "") +
      bodyText({ companyName, pdfUrl }),
    html:
      (requester ? `<p><strong>Requested by:</strong> ${escapeHtml(requester)}</p>` : "") +
      bodyHtml({ companyName, pdfUrl }),
    attachments: [
      {
        filename: "TreasuryMap-shortlist.pdf",
        content: pdfBuffer, // Resend SDK accepts Buffer directly
        contentType: "application/pdf",
      },
    ],
  };

  if (!isCredsAvailable()) {
    return saveFallback({ message, pdfPath });
  }

  try {
    const { data, error } = await resendClient().emails.send(message);
    if (error) {
      const fallback = saveFallback({ message, pdfPath, error: error.message || JSON.stringify(error) });
      return { ...fallback, smtpError: error.message || String(error) };
    }
    return { sent: true, mode: "resend", messageId: data?.id };
  } catch (err) {
    // En cas d'erreur Resend (5xx / réseau), on ne plante pas le pipeline :
    // on sauvegarde en local et on remonte l'erreur dans le résultat.
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
