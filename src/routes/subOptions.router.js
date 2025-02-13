const { Router } = require("express");
const router = Router();
const { getAllSubOptions } = require("../controllers/subOptions.controllers");

router.get("/", getAllSubOptions);

module.exports = router;
