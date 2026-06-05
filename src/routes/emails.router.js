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
const { authLimiter } = require("../middlewares/rateLimit.middleware");

router.post("/", sendEmail);
router.post("/updateMessage", updateMessage);
router.post("/createMessage", createMessage);
router.post("/restorePassword", authLimiter, restorePassword);
router.post("/signupAlert", signUpAlert);
router.post("/newPublicationAlert", newPublicationAlert);

module.exports = router;
