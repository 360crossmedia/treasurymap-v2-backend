const { sendMail, INTERNAL_INBOX, ON_SANDBOX, CONTACT_TO } = require("../utils/mailer");
const AuthServices = require("../services/auth.services");
const UsersServices = require("../services/users.services");

// Escape user-supplied values before interpolating them into email HTML. These
// endpoints accept attacker-controlled input (contact form, signup, alerts);
// without escaping, a payload could inject markup/links into the emails we send
// to the internal inbox.
function esc(value) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only allow an https image URL in the publication alert; never interpolate an
// arbitrary attacker string into an <img src>.
function safeImageUrl(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" ? u.href : "";
  } catch (_) {
    return "";
  }
}

// Contact Us form. Delivered via Resend with proper authentication (clean
// deliverability, no spam-foldering like the old empty-sender Gmail path).
// While on the Resend sandbox FROM, recipients are limited to the account owner,
// so we route to the internal inbox; once a domain is verified and EMAIL_FROM is
// updated, it delivers straight to the team list (CONTACT_TO: care@/studio@/...).
const sendEmail = async (req, res, next) => {
  const { company, message, name, email } = req.body;
  const to = ON_SANDBOX ? INTERNAL_INBOX : CONTACT_TO;
  try {
    await sendMail({
      to,
      replyTo: email,
      subject: `New Message From Contact Us TreasuryMap`,
      html: `
      <p><strong>From:</strong> ${esc(name)} (${esc(email)})</p>
      <p><strong>Company:</strong> ${esc(company)}</p>
      <p><strong>Message:</strong></p>
      <p>${esc(message)}</p>
      `,
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Contact Us email failed:", error && error.message);
    return res.status(502).json({ ok: false, error: "Email delivery failed" });
  }
};

const updateMessage = async (req, res, next) => {
  try {
    const { companyName, name, previousValue, newValue } = req.body;
    const result = await sendMail({
      to: INTERNAL_INBOX,
      subject: `Update Alert From Company ${companyName}`,
      html: `
      <h5>The user ${esc(name)} updated the company ${esc(companyName)}</h5>
      <div>
        <h4>Previous Value</h4>
        <pre>${esc(JSON.stringify(previousValue, null, 2))}</pre>
      </div>
      <div>
        <h4>New Value</h4>
        <pre>${esc(JSON.stringify(newValue, null, 2))}</pre>
      </div>
      `,
    });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const createMessage = async (req, res, next) => {
  try {
    const { companyName, name } = req.body;
    const result = await sendMail({
      to: INTERNAL_INBOX,
      subject: `New Alert From User ${name}`,
      html: `
      <h5>The user ${esc(name)} created the company ${esc(companyName)}</h5>
      `,
    });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const restorePassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await UsersServices.getUserIdByEmail(email);
    if (!user) {
      res.status(400).json({ message: "Wrong Email" });
    } else {
      // Short-lived, reset-scoped token. Sign ONLY the user id (never the full
      // user record, which would leak the bcrypt hash inside the emailed link).
      const token = AuthServices.genToken({ userId: user.id, purpose: "reset" }, "15m");
      const result = await sendMail({
        to: email,
        subject: "Restore Password",
        html: `
        <h5>For restore your password please go to this link https://treasurymap.com/restorePassword/${token}</h5>
        <h6>That link is valid for only 10 minutes</h6>
        `,
      });
      return res.status(200).json(result);
    }
  } catch (error) {
    next(error);
  }
};

const signUpAlert = async (req, res, next) => {
  try {
    const props = req.body;
    const status = props.status || "New sign-up";
    const result = await sendMail({
      to: INTERNAL_INBOX,
      replyTo: props.email,
      subject: `${status} on TreasuryMap · ${props.companyName || props.email}`,
      html: `
        <h4>${esc(status)}</h4>
        <p><strong>Email:</strong> ${esc(props.email)}</p>
        <p><strong>Full name:</strong> ${esc(props.fullName) || "-"}</p>
        <p><strong>Company:</strong> ${esc(props.companyName) || "-"}</p>
        `,
    });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const newPublicationAlert = async (req, res, next) => {
  try {
    const props = req.body;
    const img = safeImageUrl(props && props.image);
    const result = await sendMail({
      to: INTERNAL_INBOX,
      subject: `New Publication from ${props && props.companyName} On TreasuryMap`,
      html: `
        <h5>Title: ${esc(props && props.title)}</h5>
        ${img ? `<img width="300px" src="${img}" alt="image" />` : ""}
        `,
    });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendEmail,
  updateMessage,
  createMessage,
  restorePassword,
  signUpAlert,
  newPublicationAlert,
};
