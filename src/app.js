const express = require("express");
const app = express();
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

const corsOptions = {
  origin: "*",
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
