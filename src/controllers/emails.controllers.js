const { sendMail, INTERNAL_INBOX, ON_SANDBOX, CONTACT_TO } = require("../utils/mailer");
const AuthServices = require("../services/auth.services");
const UsersServices = require("../services/users.services");

// Contact Us form. Delivered via Resend with proper authentication (clean
// deliverability — no spam-foldering like the old empty-sender Gmail path).
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
      <p><strong>From:</strong> ${name} (${email})</p>
      <p><strong>Company:</strong> ${company}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
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
