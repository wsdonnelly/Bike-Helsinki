const {
  hasKdSnap,
  hasRouter,
  getKdSnapGraphInfo,
} = require("../services/addons.service");
const { getGraphInfo } = require("../services/graph.service");

function healthz(_req, res) {
  const addons = { kdSnap: hasKdSnap(), router: hasRouter() };
  const graphInfo = getGraphInfo();
  const kdSnapGraphInfo = getKdSnapGraphInfo();
  const totalNodes = graphInfo?.numNodes ?? 0;
  const ok = !!addons.kdSnap && !!addons.router && !!graphInfo?.loaded;

  res
    .status(ok ? 200 : 503)
    .json({ ok, addons, totalNodes, graphInfo, kdSnapGraphInfo });
}

module.exports = { healthz };
