const { Router } = require("express");
const router = Router();
const {
  sendEmail,
  updateMessage,
  createMessage,
  restorePassword,
  signUpAlert,
  newPublicationAlert,
} = require("../controllers/emails.controllers");
const { authLimiter, emailLimiter } = require("../middlewares/rateLimit.middleware");
const { requireAuth } = require("../middlewares/auth.middleware");

// Public, throttled: contact form and signup alert (triggered by anonymous
// visitors). HTML in the controllers is escaped.
router.post("/", emailLimiter, sendEmail);
router.post("/signupAlert", emailLimiter, signUpAlert);
router.post("/restorePassword", authLimiter, restorePassword);

// Internal alerts: only ever fired by an authenticated vendor/admin from the
// dashboard, so require auth (and still throttle).
router.post("/updateMessage", emailLimiter, requireAuth, updateMessage);
router.post("/createMessage", emailLimiter, requireAuth, createMessage);
router.post("/newPublicationAlert", emailLimiter, requireAuth, newPublicationAlert);

module.exports = router;
