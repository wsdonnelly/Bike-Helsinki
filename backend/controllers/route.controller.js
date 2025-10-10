const {
  hasRouter,
  getRouter,
  getTypedArrays,
} = require("../services/addons.service");
const { getTotalNodes } = require("../services/graph.service");
const {
  toIndex,
  clampU16,
  finiteOr,
  sanitizeFactors,
} = require("../lib/numbers");
const { findPathAsync } = require("../services/route.service");

const defaults = {
  bikeSurfaceMask: 0xffff,
  bikeSpeedMps: 6.0,
  walkSpeedMps: 1.5,
  rideToWalkPenaltyS: 5.0,
  walkToRidePenaltyS: 3.0,
  bikeSurfaceFactor: [],
  walkSurfaceFactor: [],
  surfacePenaltySPerKm: 0.0,
};

async function createRoute(req, res) {
  if (!hasRouter())
    return res.status(503).json({ error: "route addon not loaded" });

  const TOTAL_NODES = getTotalNodes();
  if (!Number.isInteger(TOTAL_NODES) || TOTAL_NODES <= 0) {
    return res.status(503).json({ error: "graph not loaded" });
  }

  const {
    startIdx,
    endIdx,
    bikeSurfaceMask,
    bikeSpeedMps,
    walkSpeedMps,
    rideToWalkPenaltyS,
    walkToRidePenaltyS,
    bikeSurfaceFactor,
    walkSurfaceFactor,
    surfacePenaltySPerKm,
  } = req.body || {};

  const s = toIndex(startIdx);
  const e = toIndex(endIdx);
  if (!Number.isInteger(s) || !Number.isInteger(e)) {
    return res
      .status(400)
      .json({ error: "startIdx and endIdx must be integers" });
  }
  if (s < 0 || e < 0 || s >= TOTAL_NODES || e >= TOTAL_NODES) {
    return res
      .status(400)
      .json({ error: `startIdx/endIdx out of range (0..${TOTAL_NODES - 1})` });
  }

  const opts = {
    sourceIdx: s,
    targetIdx: e,
    bikeSurfaceMask: clampU16(bikeSurfaceMask, defaults.bikeSurfaceMask),
    bikeSpeedMps: finiteOr(bikeSpeedMps, defaults.bikeSpeedMps),
    walkSpeedMps: finiteOr(walkSpeedMps, defaults.walkSpeedMps),
    rideToWalkPenaltyS: finiteOr(
      rideToWalkPenaltyS,
      defaults.rideToWalkPenaltyS
    ),
    walkToRidePenaltyS: finiteOr(
      walkToRidePenaltyS,
      defaults.walkToRidePenaltyS
    ),
    surfacePenaltySPerKm: finiteOr(
      surfacePenaltySPerKm,
      defaults.surfacePenaltySPerKm
    ),
  };

  const bs = sanitizeFactors(bikeSurfaceFactor);
  const ws = sanitizeFactors(walkSurfaceFactor);
  if (bs) opts.bikeSurfaceFactor = bs;
  if (ws) opts.walkSurfaceFactor = ws;

  const router = getRouter();
  const { LAT, LON } = getTypedArrays();

  try {
    const result = await findPathAsync(router, opts);

    const pathIdx = Array.isArray(result.path) ? result.path : [];
    const modes = Array.isArray(result.modes) ? result.modes : [];
    const {
      distanceM,
      durationS,
      distanceBikePreferred,
      distanceBikeNonPreferred,
      distanceWalk,
    } = result;

    let coords = [];
    if (LAT && LON && pathIdx.length) {
      coords = new Array(pathIdx.length);
      for (let i = 0; i < pathIdx.length; ++i) {
        const idx = pathIdx[i] >>> 0;
        if (idx >= TOTAL_NODES) {
          coords = [];
          break;
        }
        coords[i] = [LAT[idx], LON[idx]];
      }
    }
    if (!coords.length && pathIdx.length) {
      try {
        coords = pathIdx.map((idx) => {
          const n = router.getNode(idx);
          return [n.lat, n.lon];
        });
      } catch (e2) {
        console.warn("coord fallback failed:", e2);
        coords = [];
      }
    }

    const startCoord = LAT && LON ? [LAT[s], LON[s]] : undefined;
    const endCoord = LAT && LON ? [LAT[e], LON[e]] : undefined;

    return res.json({
      path: pathIdx,
      coords,
      modes,
      distanceM,
      durationS,
      distanceBikePreferred,
      distanceBikeNonPreferred,
      distanceWalk,
      startCoord,
      endCoord,
    });
  } catch (err) {
    console.error("findPath error:", err);

    // OSM debug links
    try {
      const sourceId = router.getNodeIdByIdx(opts.sourceIdx);
      console.error(
        "source:",
        `https://api.openstreetmap.org/api/0.6/node/${sourceId}/ways`
      );
      const targetId = router.getNodeIdByIdx(opts.targetIdx);
      console.error(
        "target:",
        `https://api.openstreetmap.org/api/0.6/node/${targetId}/ways`
      );
    } catch (_) {}

    if (String(err).includes("no route")) {
      return res.json({
        path: [],
        coords: [],
        modes: [],
        distanceM: 0,
        durationS: 0,
        distanceBikePreferred: 0,
        distanceBikeNonPreferred: 0,
        distanceWalk: 0,
      });
    }
    return res.status(500).json({ error: String(err) });
  }
}

module.exports = { createRoute };
