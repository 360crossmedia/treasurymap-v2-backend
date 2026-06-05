const express = require("express");
const app = express();

// Trust the reverse proxy in front of us (Railway / load balancers).
// Without this, express-rate-limit sees the proxy IP instead of the real
// client IP, and emits ERR_ERL_UNEXPECTED_X_FORWARDED_FOR warnings.
app.set("trust proxy", 1);

const cors = require("cors");
const morgan = require("morgan");
const db = require("./utils/database");
const initModels = require("./models/init.models");
const routerApi = require("./routes");
const seeder = require("./seeders/seed");
var cloudinary = require("cloudinary").v2;
const bodyParser = require("body-parser");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure: true,
});

// Restrict cross-origin browser access to the known frontend origins (the API
// serves auth + write endpoints, so a wildcard let any site call it). Override
// the list in prod with CORS_ORIGINS (comma-separated). Requests with no Origin
// header (curl, server-to-server, health checks) are allowed.
const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS ||
  [
    "https://treasurymap-v2-production.up.railway.app",
    "https://treasurymap.com",
    "https://www.treasurymap.com",
    "http://localhost:3000",
  ].join(",")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
};

app.use(bodyParser.json({ limit: "3mb" }));
app.use(bodyParser.urlencoded({ limit: "3mb", extended: true }));
app.use(express.json());
app.use(cors(corsOptions));
app.use(morgan("tiny"));

initModels();
db.authenticate()
  .then(() => console.log("BD authenticate"))
  .catch((error) => console.log(error));

db.sync({ alter: true })
  .then(() => {
    console.log("db synched");
    // seeder();
  })
  .catch((error) => console.log(error));

routerApi(app);

module.exports = app;
