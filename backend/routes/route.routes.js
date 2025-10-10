const { Router } = require("express");
const { createRoute } = require("../controllers/route.controller");

const router = Router();
router.post("/", createRoute);
module.exports = router;
