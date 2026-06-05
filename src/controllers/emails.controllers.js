const { sendMail, INTERNAL_INBOX } = require("../utils/mailer");
const AuthServices = require("../services/auth.services");
const UsersServices = require("../services/users.services");

// Contact Us form. Behaves exactly like the current live map: it delegates to
// backend A's working contact endpoint (Gmail -> care@/contact@/studio@). If A
// is unreachable, it falls back to the local Resend mailer (internal inbox).
const LIVE_CONTACT_ENDPOINT =
  "https://treasurymapbackend-production.up.railway.app/api/v1/email";

const sendEmail = async (req, res, next) => {
  const { company, message, name, email } = req.body;

  // 1) Mirror the current map — delegate to backend A.
  try {
    const r = await fetch(LIVE_CONTACT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, message, name, email }),
    });
    if (r.ok) return res.status(200).json({ ok: true });
    console.error("Contact proxy to backend A failed:", r.status);
  } catch (e) {
    console.error("Contact proxy to backend A error:", e && e.message);
  }

  // 2) Fallback — local mailer (Resend -> internal inbox), reply-to the visitor.
  try {
    await sendMail({
      to: INTERNAL_INBOX,
      replyTo: email,
      subject: `New Message From Contact Us TreasuryMap`,
      html: `
      <p>Email: ${email}</p>
      <p>Company: ${company}</p>
      <p>Name: ${name}</p>
      <p>Message: ${message}</p>
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
      <h5>The user ${name} updated the company ${companyName}</h5>
      <div>
        <h4>Previous Value</h4>
        <pre>${JSON.stringify(previousValue, null, 2)}</pre>
      </div>
      <div>
        <h4>New Value</h4>
        <pre>${JSON.stringify(newValue, null, 2)}</pre>
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
      <h5>The user ${name} created the company ${companyName}</h5>
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
    const userId = await UsersServices.getUserIdByEmail(email);
    if (!userId) {
      res.status(400).json({ message: "Wrong Email" });
    } else {
      const token = AuthServices.genToken({ userId });
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
    const result = await sendMail({
      to: INTERNAL_INBOX,
      subject: "New Sign Up On TreasuryMap",
      html: `
        <h5>Email: ${props.email}</h5>
        <h5>Full name: ${props.fullName}</h5>
        <h5>Company name: ${props.companyName}</h5>
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
    const result = await sendMail({
      to: INTERNAL_INBOX,
      subject: `New Publication from ${props?.companyName} On TreasuryMap`,
      html: `
        <h5>Title: ${props?.title}</h5>
        <img width="300px" src=${props?.image} alt="image" />
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
