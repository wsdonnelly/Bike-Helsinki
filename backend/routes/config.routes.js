const { Router } = require("express");
const { getHelsinkiConfig } = require("../controllers/config.controller");

const router = Router();

// GET /config/helsinki
router.get("/helsinki", getHelsinkiConfig);

module.exports = router;
