// Unified mailer. Prefers Resend (configured on this backend) and falls back to
// the legacy Gmail/nodemailer transporter when Resend isn't available.
//
// NOTE on recipients: until a domain is verified on Resend, the sandbox FROM
// ("onboarding@resend.dev") can ONLY deliver to the Resend account owner
// (relations@360crossmedia.com). So internal notifications are routed there via
// the INTERNAL_INBOX constant. Once a domain is verified, set EMAIL_FROM to an
// address on that domain and CONTACT_TO to the full team list — no code change.
const { Resend } = require("resend");
const transporter = require("./nodemailer");

const FROM = process.env.EMAIL_FROM || "TreasuryMap <onboarding@resend.dev>";

// Inbox that receives contact-form messages and internal alerts.
const INTERNAL_INBOX = process.env.CONTACT_TO || "relations@360crossmedia.com";

const resendReady = () =>
  !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "local-dev-noop";

let _resend = null;
const client = () => (_resend = _resend || new Resend(process.env.RESEND_API_KEY));

const toArray = (to) =>
  Array.isArray(to)
    ? to
    : String(to || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

// Sends an email. Throws on failure so callers can decide (some are best-effort).
async function sendMail({ to, subject, html, text, replyTo }) {
  const recipients = toArray(to);
  if (resendReady()) {
    const { data, error } = await client().emails.send({
      from: FROM,
      to: recipients,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    });
    if (error) {
      const e = new Error(error.message || JSON.stringify(error));
      e.resend = error;
      throw e;
    }
    return { mode: "resend", id: data && data.id };
  }
  // Legacy fallback (Gmail). Will only work if G_PASSWORD is a real app password.
  const result = await transporter.sendMail({
    to: recipients.join(", "),
    subject,
    html,
    text,
    ...(replyTo ? { replyTo } : {}),
  });
  return { mode: "gmail", result };
}

module.exports = { sendMail, INTERNAL_INBOX, FROM };
