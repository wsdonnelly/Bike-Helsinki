const { Router } = require("express");
const { healthz } = require("../controllers/health.controller");

const router = Router();
router.get("/", healthz);
module.exports = router;
