const jwt = require("jsonwebtoken");
require("dotenv").config();

function getToken(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

// Verify the JWT issued at login (signed server-side with JWT_SECRET, HS512).
// Attaches req.user = { username, id, email }. 401 if missing/invalid/expired.
const requireAuth = (req, res, next) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ message: "Authentication required" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS512"] });
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
};

// Admin = user id 1 (no role column yet). Derived from the VERIFIED token,
// so it can't be spoofed via localStorage like the old client-side check.
const requireAdmin = (req, res, next) =>
  requireAuth(req, res, () => {
    if (Number(req.user && req.user.id) === 1) return next();
    return res.status(403).json({ message: "Admin only" });
  });

// Decode the token if present (sets req.user) but never rejects. Lets a public
// endpoint optionally enrich its response for authenticated callers.
const optionalAuth = (req, res, next) => {
  const token = getToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS512"] });
    } catch (_) {}
  }
  next();
};

module.exports = { requireAuth, requireAdmin, optionalAuth };
