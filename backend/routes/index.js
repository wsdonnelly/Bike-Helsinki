const { Router } = require("express");
const healthRoutes = require("./health.routes");
const snapRoutes = require("./snap.routes");
const routeRoutes = require("./route.routes");

const router = Router();

router.use("/healthz", healthRoutes); // GET /healthz
router.use("/snap", snapRoutes); // GET /snap
router.use("/route", routeRoutes); // POST /route

module.exports = router;
