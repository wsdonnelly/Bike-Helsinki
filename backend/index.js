const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const fs = require('fs');
const path = require('path');

// Attempt to load the native addons (build/Release/…)
console.log('Initial:', process.memoryUsage());
let kdSnap
let router
try {
  kdSnap = require('./bindings/build/Release/kd_snap.node')
  router = require('./bindings/build/Release/route.node')
  console.log('After reading route.node:', process.memoryUsage());
} catch (err) {
  console.warn('Native addons not found:', err)
  kdSnap = null
  router = null
}

const app = express();
app.use(bodyParser.json());
app.use(cors())

const nodesBin = fs.readFileSync(path.join('../data/graph_nodes.bin'));
const TOTAL_NODES = nodesBin.readUInt32LE(0);
console.log('TOTAL_NODES =', TOTAL_NODES);
console.log("at end",process.memoryUsage());

//test
// let start = Date.now();
// console.log(kdSnap.findNearest(60.17, 24.94));  // nodeIdx
// console.log('snap time:', Date.now() - start, 'ms');

// console.log(kdSnap.getNode(42));                // { nodeIdx, lat, lon }
// start = Date.now();
// console.log("find path", router.findPath(0, 100));        // array of {nodeIdx,lat,lon}
// console.log('dijstra time:', Date.now() - start, 'ms');

// GET /snap?lat=...&lon=... → { nodeIdx, lat, lon }
app.get('/snap', (req, res) => {
  console.log('▶︎ /route incoming', req.query);
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Invalid lat/lon' });
  }
  try {
    const idx = kdSnap.findNearest(lat, lon);
    const coord = kdSnap.getNode(idx);
    //debug
    console.log('snap request →', { lat, lon }, 'nearest idx →', idx, 'coord →', coord);

    return res.json(coord);
  } catch (e) {
    console.error('Snap error:', e);
    return res.status(500).json({ error: e.message });
  }
});

app.get('/route', (req, res) => {
  // 1) Destructure the query params
  const { startIdx, endIdx } = req.query;

  console.log('▶︎ /route incoming', req.query);

  // 2) If someone accidentally called /route?lat=…&lon=…, reject:
  if (typeof startIdx === 'undefined' || typeof endIdx === 'undefined') {
    console.warn('✖ Missing startIdx or endIdx');
    return res.status(400).json({
      error: 'Missing required query parameters: startIdx and endIdx'
    });
  }

  // 3) Convert to integers
  const s = parseInt(startIdx, 10);
  const e = parseInt(endIdx,   10);

  if (Number.isNaN(s) || Number.isNaN(e)) {
    console.warn('✖ Invalid integer values:', { startIdx, endIdx });
    return res.status(400).json({
      error: 'startIdx and endIdx must be valid integers'
    });
  }

  // 4) Bound check using previously‐read TOTAL_NODES
  if (s < 0 || e < 0 || s >= TOTAL_NODES || e >= TOTAL_NODES) {
    console.warn('✖ Out of range:', { s, e });
    return res.status(400).json({
      error: `startIdx/endIdx out of range: must be 0 ≤ idx < ${TOTAL_NODES}`
    });
  }

  // 5) Run routing
  console.log(`… calling findPath(${s}, ${e})`);
  try {
    const path = router.findPath(s, e);
    console.log(`✔ findPath returned ${path.length} points`);
    return res.json({ path });
  }
  catch (err) {
    console.error('✖ Exception in findPath:', err.message);
    // If it was our broken‐chain, return empty array
    if (err.message.includes('Broken predecessor chain') ||
        err.message.includes('No route found')) {
      return res.json({ path: [] });
    }
    // Otherwise, real 500
    return res.status(500).json({ error: err.message });
  }
});

// POST /filter → sets surface type filter mask
app.post('/filter', (req, res) => {
  const { mask } = req.body;

  // Validate mask is BitWidth length (SurfaceTypes.hpp) currently uint16_t
  if (typeof mask !== 'number' || !Number.isInteger(mask)) {
    console.warn('✖ Invalid or missing "mask" in request body');
    return res.status(400).json({
      error: 'Missing or invalid "mask" in request body. Must be an integer.'
    });
  }

  if (mask < 0 || mask > 0xFFFF) {
    return res.status(400).json({
      error: 'Surface mask must be a 16-bit unsigned integer (0x0–0xFFFF)'
    });
  }

  try {
    router.buildFilteredGraph(mask);
    console.log(`✔ Surface filter updated: 0x${mask.toString(16).padStart(4, '0')}`);
    return res.status(204).send(); // No content, success
  } catch (err) {
    console.error('✖ Exception in buildFilteredGraph:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(3000, ()=> console.log('Server on http://localhost:3000'));
