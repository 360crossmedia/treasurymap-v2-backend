const rateLimit = require("express-rate-limit");

// Throttle auth-sensitive endpoints (login, register, password reset/restore)
// to slow brute-force, credential-stuffing and reset-spam. Generous enough for
// real users behind shared NATs. app.js sets `trust proxy` so the limiter keys
// on the real client IP, not the Railway proxy.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

module.exports = { authLimiter };
