const transporter = require("../utils/nodemailer");
const AuthServices = require("../services/auth.services");
const UsersServices = require("../services/users.services");

const sendEmail = async (req, res, next) => {
  try {
    const { company, message, name, email } = req.body;
    const result = await transporter.sendMail({
      to: "treasury.map.project@gmail.com, contact@360crossmedia.com, care@360crossmedia.com, studio@360crossmedia.com",
      subject: `New Message From Contact Us TreasuryMap`,
      html: `
      <p>Email: ${email}</p>
      <p>Company: ${company}</p>
      <p>Name: ${name}</p>
      <p>Message: ${message}</p>
      `,
    });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updateMessage = async (req, res, next) => {
  try {
    const { companyName, name, previousValue, newValue } = req.body;
    const result = await transporter.sendMail({
      to: "treasury.map.project@gmail.com",
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
    const result = await transporter.sendMail({
      to: "treasury.map.project@gmail.com",
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
      const result = await transporter.sendMail({
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
    const result = await transporter.sendMail({
      to: "treasury.map.project@gmail.com, contact@360crossmedia.com, care@360crossmedia.com",
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
    const result = await transporter.sendMail({
      to: "treasury.map.project@gmail.com, care@360crossmedia.com",
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
