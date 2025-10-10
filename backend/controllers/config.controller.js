const { loadHelsinkiConfig } = require("../services/helsinki.service");

async function getHelsinkiConfig(_req, res, next) {
  try {
    const cfg = await loadHelsinkiConfig();
    res.json(cfg);
  } catch (err) {
    next(err);
  }
}

module.exports = { getHelsinkiConfig };
