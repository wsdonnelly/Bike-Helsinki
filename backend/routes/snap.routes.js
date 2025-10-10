const { Router } = require("express");
const { snap } = require("../controllers/snap.controller");

const router = Router();
router.get("/", snap);
module.exports = router;
