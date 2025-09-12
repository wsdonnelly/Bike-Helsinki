const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
// Optional hardening (costs a tiny bit of CPU):
// const helmet = require("helmet"); const compression = require("compression");

const app = express();
app.disable("x-powered-by");
// app.use(helmet());
app.use(express.json({ limit: "256kb" }));
app.use(cors());

// --- Native addons
let kdSnap = null,
  router = null;
try {
  kdSnap = require("./bindings/build/Release/kd_snap.node");
  router = require("./bindings/build/Release/route.node");
  console.log("Native addons loaded");
} catch (err) {
  console.warn("Native addons not found:", err?.message || err);
}

// --- Typed arrays (if addon is present)
let LAT = null,
  LON = null;
if (kdSnap) {
  LAT = kdSnap.getLatArray();
  LON = kdSnap.getLonArray();
  console.log(
    "LAT/LON typed arrays:",
    LAT?.constructor?.name,
    LAT?.length,
    LON?.length
  );
}

// --- Graph file (Render: keep under backend/ or copy in build/preDeploy)
const DEFAULT_GRAPH = path.resolve(__dirname, "./data/graph_nodes.bin");
const nodesPath = process.env.GRAPH_NODES
  ? path.resolve(process.env.GRAPH_NODES)
  : DEFAULT_GRAPH;

let TOTAL_NODES = 0;
function readTotalNodes(buf) {
  if (buf.length >= 20 && buf.subarray(0, 8).toString("ascii") === "MMAPNODE") {
    return buf.readUInt32LE(8);
  }
  return undefined;
}
try {
  if (!fs.existsSync(nodesPath)) {
    console.warn(`Graph file not found at ${nodesPath}`);
  } else {
    const nodesBin = fs.readFileSync(nodesPath);
    TOTAL_NODES = readTotalNodes(nodesBin) ?? 0;
    console.log("TOTAL_NODES =", TOTAL_NODES);
  }
} catch (e) {
  console.error("Failed to read graph file:", e?.message || e);
}

// --- Local dev only: static frontend (disable on Render)
if (process.env.SERVE_STATIC === "1") {
  const distDir = path.resolve(__dirname, "../frontend/dist");
  app.use(express.static(distDir, { index: false }));
  app.get("/:path*", (_req, res) =>
    res.sendFile(path.join(distDir, "index.html"))
  );
}

// --- Helpers & defaults
const toIndex = (v) =>
  Number.isInteger(v) ? v : Number.isInteger(Number(v)) ? Number(v) : NaN;
const clampU16 = (v, fb) => (Number.isInteger(v) ? v & 0xffff : fb);
const finiteOr = (v, fb) => (Number.isFinite(v) ? v : fb);
const sanitizeFactors = (arr) =>
  Array.isArray(arr)
    ? arr.map((x) => (Number.isFinite(Number(x)) ? Number(x) : 1))
    : undefined;

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

// --- Healthcheck
app.get("/healthz", (_req, res) => {
  const ok = !!router && !!kdSnap && TOTAL_NODES > 0;
  res.status(ok ? 200 : 503).json({
    ok,
    addons: { kdSnap: !!kdSnap, router: !!router },
    totalNodes: TOTAL_NODES,
  });
});

// --- /snap
app.get("/snap", (req, res) => {
  if (!kdSnap)
    return res.status(503).json({ error: "kdSnap addon not loaded" });
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "Invalid lat/lon" });
  }
  try {
    const idx = kdSnap.findNearest(lat, lon);
    const coord = kdSnap.getNode(idx); // { idx, lat, lon }
    return res.json(coord);
  } catch (e) {
    console.error("Snap error:", e);
    return res.status(500).json({ error: String(e.message || e) });
  }
});

// --- /route
app.post("/route", (req, res) => {
  if (!router) return res.status(503).json({ error: "route addon not loaded" });
  if (!Number.isInteger(TOTAL_NODES) || TOTAL_NODES <= 0)
    return res.status(503).json({ error: "graph not loaded" });

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

  router.findPath(opts, (err, result) => {
    if (err) {
      console.error("findPath error:", err);
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

    const pathIdx = Array.isArray(result.path) ? result.path : [];
    const modes = Array.isArray(result.modes) ? result.modes : [];
    const { distanceM, durationS, distanceBikePreferred, distanceBikeNonPreferred, distanceWalk } = result;

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
    if (!coords.length && kdSnap && pathIdx.length) {
      try {
        coords = pathIdx.map((idx) => {
          const n = kdSnap.getNode(idx);
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
  });
});

// --- Shutdown signals (Render uses SIGTERM on redeploy)
const server = app.listen(Number(process.env.PORT || 3000), () => {
  console.log(`Server on http://localhost:${server.address().port}`);
});
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server…");
  server.close(() => process.exit(0));
});
