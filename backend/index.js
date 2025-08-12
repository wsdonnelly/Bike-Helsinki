// backend/index.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

console.log('Initial:', process.memoryUsage());

let kdSnap = null;
let router = null;
try {
  kdSnap = require('./bindings/build/Release/kd_snap.node');
  router = require('./bindings/build/Release/route.node');
  console.log('After reading route.node and kd_snap:', process.memoryUsage());
} catch (err) {
  console.warn('Native addons not found:', err);
}

// ---------- read num_nodes from graph_nodes.bin (new header + legacy fallback)
const nodesPath = path.join('../data/graph_nodes.bin');
const nodesBin = fs.readFileSync(nodesPath);

function readTotalNodes(buf) {
  if (buf.length >= 20) {
    const magic = buf.subarray(0, 8).toString('ascii');
    if (magic === 'MMAPNODE') {
      const version = buf.readUInt32LE(8);
      if (version !== 1) throw new Error(`Unsupported nodes version: ${version}`);
      const numNodes = buf.readUInt32LE(12);
      // coord_type at offset 16, reserved at 17..19 (ignored)
      return numNodes;
    }
  }
  // Legacy fallback: first 4 bytes were numNodes
  if (buf.length >= 4) return buf.readUInt32LE(0);
  throw new Error('graph_nodes.bin too small');
}

const TOTAL_NODES = readTotalNodes(nodesBin);
console.log('TOTAL_NODES =', TOTAL_NODES);
console.log('at end', process.memoryUsage());

// ---------- server defaults (used if client omits options on /route)
const defaults = {
  bikeSurfaceMask: 0xFFFF,
  walkSurfaceMask: 0xFFFF,
  bikeSpeedMps: 6.0,      // ~21.6 km/h
  walkSpeedMps: 1.5,      // ~5.4 km/h
  rideToWalkPenaltyS: 5.0,
  walkToRidePenaltyS: 3.0,
  bikeSurfaceFactor: [],  // optional arrays aligned to your primary enum indices
  walkSurfaceFactor: []
};

const app = express();
app.use(bodyParser.json());
app.use(cors());

// ---------- /snap (nearest node)
app.get('/snap', (req, res) => {
  if (!kdSnap) return res.status(503).json({ error: 'kdSnap addon not loaded' });

  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'Invalid lat/lon' });
  }

  try {
    const idx = kdSnap.findNearest(lat, lon);
    const coord = kdSnap.getNode(idx); // { lat, lon, idx } (assuming your addon returns this)
    console.log('snap →', { lat, lon, idx });
    return res.json(coord);
  } catch (e) {
    console.error('Snap error:', e);
    return res.status(500).json({ error: e.message });
  }
});

// ---------- /route (POST) — two-mode A* with per-request options
// Body:
// {
//   startIdx: <u32>, endIdx: <u32>,
//   bikeSurfaceMask?: <u16>, walkSurfaceMask?: <u16>,
//   bikeSpeedMps?: <number>, walkSpeedMps?: <number>,
//   rideToWalkPenaltyS?: <number>, walkToRidePenaltyS?: <number>,
//   bikeSurfaceFactor?: number[], walkSurfaceFactor?: number[]
// }
app.post('/route', (req, res) => {
  if (!router) return res.status(503).json({ error: 'route addon not loaded' });

  const {
    startIdx, endIdx,
    bikeSurfaceMask, walkSurfaceMask,
    bikeSpeedMps, walkSpeedMps,
    rideToWalkPenaltyS, walkToRidePenaltyS,
    bikeSurfaceFactor, walkSurfaceFactor
  } = req.body || {};

  if (!Number.isInteger(startIdx) || !Number.isInteger(endIdx)) {
    return res.status(400).json({ error: 'startIdx and endIdx must be integers' });
  }
  if (startIdx < 0 || endIdx < 0 || startIdx >= TOTAL_NODES || endIdx >= TOTAL_NODES) {
    return res.status(400).json({ error: `startIdx/endIdx out of range (0..${TOTAL_NODES - 1})` });
  }

  const opts = {
    sourceIdx: startIdx,
    targetIdx: endIdx,
    bikeSurfaceMask: Number.isInteger(bikeSurfaceMask) ? (bikeSurfaceMask & 0xFFFF) : defaults.bikeSurfaceMask,
    walkSurfaceMask: Number.isInteger(walkSurfaceMask) ? (walkSurfaceMask & 0xFFFF) : defaults.walkSurfaceMask,
    bikeSpeedMps: Number.isFinite(bikeSpeedMps) ? bikeSpeedMps : defaults.bikeSpeedMps,
    walkSpeedMps: Number.isFinite(walkSpeedMps) ? walkSpeedMps : defaults.walkSpeedMps,
    rideToWalkPenaltyS: Number.isFinite(rideToWalkPenaltyS) ? rideToWalkPenaltyS : defaults.rideToWalkPenaltyS,
    walkToRidePenaltyS: Number.isFinite(walkToRidePenaltyS) ? walkToRidePenaltyS : defaults.walkToRidePenaltyS
  };

  if (Array.isArray(bikeSurfaceFactor)) opts.bikeSurfaceFactor = bikeSurfaceFactor.map(Number);
  if (Array.isArray(walkSurfaceFactor)) opts.walkSurfaceFactor = walkSurfaceFactor.map(Number);

  // Call async addon
  router.findPath(opts, (err, result) => {
    if (err) {
      console.error('findPath error:', err);
      // Normalize common "no route" to 200 with empty response (UX-friendly)
      if (String(err).includes('no route')) return res.json({ path: [], modes: [], distance_m: 0, duration_s: 0 });
      return res.status(500).json({ error: String(err) });
    }
    // result: { path:[...nodeIdx], modes:[1|2 per segment], distance_m, duration_s }
    return res.json(result);
  });
});

// ---------- Backward-compat: GET /route?startIdx=..&endIdx=.. (&optional simple options)
app.get('/route', (req, res) => {
  // Allow quick manual testing without crafting JSON; uses server defaults
  const startIdx = parseInt(req.query.startIdx, 10);
  const endIdx = parseInt(req.query.endIdx, 10);
  if (!Number.isInteger(startIdx) || !Number.isInteger(endIdx)) {
    return res.status(400).json({ error: 'startIdx and endIdx must be integers' });
  }
  if (startIdx < 0 || endIdx < 0 || startIdx >= TOTAL_NODES || endIdx >= TOTAL_NODES) {
    return res.status(400).json({ error: `startIdx/endIdx out of range (0..${TOTAL_NODES - 1})` });
  }

  // Optional query params: bikeMask, walkMask, bikeSpeed, walkSpeed, dismount, remount
  const q = req.query;
  const opts = {
    sourceIdx: startIdx,
    targetIdx: endIdx,
    bikeSurfaceMask: Number.isInteger(+q.bikeMask) ? (+q.bikeMask & 0xFFFF) : defaults.bikeSurfaceMask,
    walkSurfaceMask: Number.isInteger(+q.walkMask) ? (+q.walkMask & 0xFFFF) : defaults.walkSurfaceMask,
    bikeSpeedMps: Number.isFinite(+q.bikeSpeed) ? +q.bikeSpeed : defaults.bikeSpeedMps,
    walkSpeedMps: Number.isFinite(+q.walkSpeed) ? +q.walkSpeed : defaults.walkSpeedMps,
    rideToWalkPenaltyS: Number.isFinite(+q.dismount) ? +q.dismount : defaults.rideToWalkPenaltyS,
    walkToRidePenaltyS: Number.isFinite(+q.remount) ? +q.remount : defaults.walkToRidePenaltyS
  };

  router.findPath(opts, (err, result) => {
    if (err) {
      if (String(err).includes('no route')) return res.json({ path: [], modes: [], distance_m: 0, duration_s: 0 });
      return res.status(500).json({ error: String(err) });
    }
    return res.json(result);
  });
});

// ---------- /filter — update server defaults (no longer rebuilds graphs)
// Body: { bikeSurfaceMask?: u16, walkSurfaceMask?: u16, ...same keys as defaults... }
app.post('/filter', (req, res) => {
  const b = req.body || {};

  if (Number.isInteger(b.bikeSurfaceMask)) defaults.bikeSurfaceMask = (b.bikeSurfaceMask & 0xFFFF);
  if (Number.isInteger(b.walkSurfaceMask)) defaults.walkSurfaceMask = (b.walkSurfaceMask & 0xFFFF);

  if (Number.isFinite(b.bikeSpeedMps)) defaults.bikeSpeedMps = b.bikeSpeedMps;
  if (Number.isFinite(b.walkSpeedMps)) defaults.walkSpeedMps = b.walkSpeedMps;

  if (Number.isFinite(b.rideToWalkPenaltyS)) defaults.rideToWalkPenaltyS = b.rideToWalkPenaltyS;
  if (Number.isFinite(b.walkToRidePenaltyS)) defaults.walkToRidePenaltyS = b.walkToRidePenaltyS;

  if (Array.isArray(b.bikeSurfaceFactor)) defaults.bikeSurfaceFactor = b.bikeSurfaceFactor.map(Number);
  if (Array.isArray(b.walkSurfaceFactor)) defaults.walkSurfaceFactor = b.walkSurfaceFactor.map(Number);

  // NOTE: we no longer rebuild a filtered KD-tree. Snapping stays geometric;
  // masks are enforced during routing. If you still want to filter KD nodes,
  // you'll need an API that returns "allowedIndices" from your ingest or addon.

  console.log('✔ Defaults updated:', defaults);
  return res.status(204).send();
});

// Optional: expose current defaults for the frontend
app.get('/filter', (req, res) => res.json(defaults));

// ---------- remove or stub the old /full debug endpoint
app.get('/full', (req, res) => {
  return res.status(410).json({ error: 'Deprecated in A*/mmap build' });
});

app.listen(3000, () => console.log('Server on http://localhost:3000'));
