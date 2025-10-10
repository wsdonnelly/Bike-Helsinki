const { hasKdSnap, hasRouter } = require("../services/addons.service");
const { getTotalNodes } = require("../services/graph.service");

function healthz(_req, res) {
  const addons = { kdSnap: hasKdSnap(), router: hasRouter() };
  const totalNodes = getTotalNodes();
  const ok = !!addons.kdSnap && !!addons.router && totalNodes > 0;

  res.status(ok ? 200 : 503).json({ ok, addons, totalNodes });
}

module.exports = { healthz };
