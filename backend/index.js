const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
// Optional: const compression = require('compression'); const helmet = require('helmet');

let kdSnap = null;
let router = null;
try {
  kdSnap = require('./bindings/build/Release/kd_snap.node');
  router = require('./bindings/build/Release/route.node');
  console.log('Native addons loaded:', process.memoryUsage());
} catch (err) {
  console.warn('Native addons not found:', err);
}

let LAT = null, LON = null;
if (kdSnap) {
  // Float32Arrays (no copy)
  LAT = kdSnap.getLatArray();
  LON = kdSnap.getLonArray();
}
console.log('LAT/LON typed arrays:', LAT?.constructor?.name, LAT?.length, LON?.length);

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(cors());
// Optional: app.use(compression()); app.use(helmet());

// ---------- read num_nodes from graph_nodes.bin (new header + legacy fallback)
const nodesPath = path.join('../data/graph_nodes.bin');
const nodesBin = fs.readFileSync(nodesPath);

function readTotalNodes(buf) {
  if (buf.length >= 20 && buf.subarray(0, 8).toString('ascii') === 'MMAPNODE') {
    const version = buf.readUInt32LE(8);
    if (version !== 1) throw new Error(`Unsupported nodes version: ${version}`);
    return buf.readUInt32LE(12); // num_nodes
  }
  if (buf.length >= 4) return buf.readUInt32LE(0); // legacy
  throw new Error('graph_nodes.bin too small');
}
const TOTAL_NODES = readTotalNodes(nodesBin);
console.log('TOTAL_NODES =', TOTAL_NODES);

// ---------- helpers
const toIndex = (v) => {
  // accept numbers and numeric strings
  if (Number.isInteger(v)) return v;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

const clampU16 = (v, fallback) =>
  Number.isInteger(v) ? (v & 0xFFFF) : fallback;
const finiteOr = (v, fallback) =>
  Number.isFinite(v) ? v : fallback;
const sanitizeFactors = (arr) =>
  Array.isArray(arr) ? arr.map((x) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : 1;
  }) : undefined;

const defaults = {
  bikeSurfaceMask: 0xFFFF,
  bikeSpeedMps: 6.0,      // ~21.6 km/h
  walkSpeedMps: 1.5,      // ~5.4 km/h
  rideToWalkPenaltyS: 5.0,
  walkToRidePenaltyS: 3.0,
  bikeSurfaceFactor: [],
  walkSurfaceFactor: []
};

// ---------- health/meta
app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/meta', (_req, res) => {
  res.json({
    totalNodes: TOTAL_NODES,
    defaults
    // Optionally: numEdges: router?.getMeta()?.numEdges ?? undefined
  });
});

// ---------- /snap (nearest node)
app.get('/snap', (req, res) => {
  if (!kdSnap) return res.status(503).json({ error: 'kdSnap addon not loaded' });

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'Invalid lat/lon' });
  }

  try {
    const idx = kdSnap.findNearest(lat, lon);
    const coord = kdSnap.getNode(idx); // { idx, lat, lon }
    return res.json(coord);
  } catch (e) {
    console.error('Snap error:', e);
    return res.status(500).json({ error: String(e.message || e) });
  }
});

// ---------- /route (POST)
app.post('/route', (req, res) => {
  if (!router) return res.status(503).json({ error: 'route addon not loaded' });

  const {
    startIdx, endIdx,
    bikeSurfaceMask,
    bikeSpeedMps, walkSpeedMps,
    rideToWalkPenaltyS, walkToRidePenaltyS,
    bikeSurfaceFactor, walkSurfaceFactor
  } = req.body || {};

  const s = toIndex(startIdx);
  const e = toIndex(endIdx);

  if (!Number.isInteger(s) || !Number.isInteger(e)) {
    return res.status(400).json({ error: 'startIdx and endIdx must be integers' });
  }
  if (s < 0 || e < 0 || s >= TOTAL_NODES || e >= TOTAL_NODES) {
    return res.status(400).json({ error: `startIdx/endIdx out of range (0..${TOTAL_NODES - 1})` });
  }

  const opts = {
    sourceIdx: s,
    targetIdx: e,
    bikeSurfaceMask: clampU16(bikeSurfaceMask, defaults.bikeSurfaceMask),
    bikeSpeedMps:  finiteOr(bikeSpeedMps,  defaults.bikeSpeedMps),
    walkSpeedMps:  finiteOr(walkSpeedMps,  defaults.walkSpeedMps),
    rideToWalkPenaltyS: finiteOr(rideToWalkPenaltyS, defaults.rideToWalkPenaltyS),
    walkToRidePenaltyS: finiteOr(walkToRidePenaltyS, defaults.walkToRidePenaltyS)
  };

  const bs = sanitizeFactors(bikeSurfaceFactor);
  const ws = sanitizeFactors(walkSurfaceFactor);
  if (bs) opts.bikeSurfaceFactor = bs;
  if (ws) opts.walkSurfaceFactor = ws;

  router.findPath(opts, (err, result) => {
    if (err) {
      console.error('findPath error:', err);
      if (String(err).includes('no route')) {
        return res.json({ path: [], coords: [], modes: [], distanceM: 0, durationS: 0 });
      }
      return res.status(500).json({ error: String(err) });
    }

    // Normalize naming from addon (support old/new keys)
    const pathIdx   = Array.isArray(result.path) ? result.path : [];
    const modes     = Array.isArray(result.modes) ? result.modes : [];
    const distanceM = result.distanceM ?? result.distance_m ?? 0;
    const durationS = result.durationS ?? result.duration_s ?? 0;

    // Build coords from typed arrays; fall back to kdSnap.getNode if needed
    let coords = [];
    if (LAT && LON && pathIdx.length) {
      coords = new Array(pathIdx.length);
      for (let i = 0; i < pathIdx.length; ++i) {
        // coerce to uint
        const idx = pathIdx[i] >>> 0;
        if (idx >= TOTAL_NODES) {
          coords = []; // invalidate and fall back below
          break;
        }
        coords[i] = [LAT[idx], LON[idx]];
      }
    }
    if (!coords.length && kdSnap && pathIdx.length) {
      try {
        coords = pathIdx.map((idx) => {
          const n = kdSnap.getNode(idx); // { idx, lat, lon }
          return [n.lat, n.lon];
        });
      } catch (e2) {
        console.warn('coord fallback failed:', e2);
        coords = [];
      }
    }

    // Optional convenience: include start/end coords
    const startCoord = (LAT && LON) ? [LAT[s], LON[s]] : undefined;
    const endCoord   = (LAT && LON) ? [LAT[e], LON[e]] : undefined;

    //remove path: pathIdx? not currently used, but potential future use
    return res.json({
      path: pathIdx,
      coords,         // [[lat, lon], ...] aligned with path indices
      modes,          // [1|2 per segment]
      distanceM,
      durationS,
      startCoord,
      endCoord
    });
  });
});

// ---------- /filter — update server defaults (no KD rebuild)
app.post('/filter', (req, res) => {
  const b = req.body || {};

  if (Number.isInteger(b.bikeSurfaceMask)) defaults.bikeSurfaceMask = (b.bikeSurfaceMask & 0xFFFF);

  if (Number.isFinite(b.bikeSpeedMps)) defaults.bikeSpeedMps = b.bikeSpeedMps;
  if (Number.isFinite(b.walkSpeedMps)) defaults.walkSpeedMps = b.walkSpeedMps;

  if (Number.isFinite(b.rideToWalkPenaltyS)) defaults.rideToWalkPenaltyS = b.rideToWalkPenaltyS;
  if (Number.isFinite(b.walkToRidePenaltyS)) defaults.walkToRidePenaltyS = b.walkToRidePenaltyS;

  if (Array.isArray(b.bikeSurfaceFactor)) defaults.bikeSurfaceFactor = sanitizeFactors(b.bikeSurfaceFactor);
  if (Array.isArray(b.walkSurfaceFactor)) defaults.walkSurfaceFactor = sanitizeFactors(b.walkSurfaceFactor);

  console.log('✔ Defaults updated:', defaults);
  return res.status(204).send();
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
