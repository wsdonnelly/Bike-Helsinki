const { getKdSnap, hasKdSnap } = require("../services/addons.service");

function snap(req, res) {
  if (!hasKdSnap())
    return res.status(503).json({ error: "kdSnap addon not loaded" });

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "Invalid lat/lon" });
  }

  try {
    const kdSnap = getKdSnap();
    const idx = kdSnap.findNearest(lat, lon);
    const coord = kdSnap.getNode(idx); // { idx, lat, lon }
    return res.json(coord);
  } catch (e) {
    console.error("Snap error:", e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}

module.exports = { snap };
