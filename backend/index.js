const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const fs = require('fs');         // ← readFileSync
const path = require('path');     // ← path.join

// Attempt to load the native addons (build/Release/…)
let kdSnap
let router
try {
  kdSnap = require('./bindings/build/Release/kd_snap.node')
  router = require('./bindings/build/Release/route.node')
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
console.log(process.memoryUsage());

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

// GET /route?startIdx=...&endIdx=... → { path: [ { nodeIdx, lat, lon }, … ] }
// app.get('/route', (req, res) => {
//   const s = parseInt(req.query.startIdx, 10)
//   const e = parseInt(req.query.endIdx,   10)

//   console.log("requested route start: ", req.query.startIdx, " - end index: ", req.query.endIdx);
//   if (isNaN(s) || isNaN(e)) {
//     console.warn('Invalid parameters for /route:', req.query);
//     return res.status(400).json({ error: 'Invalid startIdx/endIdx' });
//   }
//   try {
//     const path = router.findPath(s, e);
//     console.log("found path", path.size)
//     return res.json({ path });
//   } catch (ex) {
//     console.error('Route error:', ex);
//     return res.status(500).json({ error: ex.message });
//   }
// });

// app.get('/route', (req, res) => {
//   const rawStart = req.query.startIdx;
//   const rawEnd   = req.query.endIdx;

//   console.log('GET /route → startIdx:', rawStart, 'endIdx:', rawEnd);

//   const s = parseInt(rawStart, 10);
//   const e = parseInt(rawEnd,   10);

//   if (isNaN(s) || isNaN(e)) {
//     console.warn('Invalid parameters for /route:', req.query);
//     return res.status(400).json({
//       error: 'Invalid startIdx or endIdx; both must be integers'
//     });
//   }

//   try {
//     const path = router.findPath(s, e);
//     if (!Array.isArray(path)) {
//       throw new Error('Unexpected return from findPath: ' + path);
//     }
//     console.log(`Route length ${path.length} from ${s} to ${e}`);
//     return res.json({ path });
//   }
//   catch (err) {
//     console.warn(`Routing error from ${s}→${e}:`, err.message);
//     if (err.message.includes('Broken predecessor chain')) {
//       return res.json({ path: [] });
//     }
//     return res.status(500).json({
//       error: 'Routing failed: ' + err.message
//     });
//   }
// });
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
// // ─── NEW: dump all graph edges as small line-segments ───────────────────
// app.get('/all', (req, res) => {
//    console.log('GET /all invoked');
//   try {
//     // 1) Load nodes
//     const nodesPath = path.join(__dirname, '..', 'data', 'graph_nodes.bin');
//     const nb       = fs.readFileSync(nodesPath);
//     let off       = 0;
//     const N       = nb.readUInt32LE(off); off += 4;
//     // parse N entries of: uint64, float, float
//     const coords  = new Array(N);
//     for (let i = 0; i < N; i++) {
//       const id  = Number(nb.readBigUInt64LE(off)); off += 8;
//       const lat = nb.readFloatLE(off);             off += 4;
//       const lon = nb.readFloatLE(off);             off += 4;
//       coords[i] = { id, lat, lon };
//     }

//     // 2) Load edges (CSR)
//     const edgesPath = path.join(__dirname, '..', 'data', 'graph_edges.bin');
//     const eb        = fs.readFileSync(edgesPath);
//     off              = 0;
//     const N2        = eb.readUInt32LE(off); off += 4;
//     const M         = eb.readUInt32LE(off); off += 4;
//     // read CSR offsets (N2+1 of uint32)
//     const offsets   = new Uint32Array(N2+1);
//     for (let i = 0; i <= N2; i++) {
//       offsets[i] = eb.readUInt32LE(off);
//       off += 4;
//     }
//     // read M neighbors (uint32)
//     const neighbors = new Uint32Array(M);
//     for (let i = 0; i < M; i++) {
//       neighbors[i] = eb.readUInt32LE(off);
//       off += 4;
//     }
//     // skip M weights (float32)
//     off += 4 * M;

//     // 3) Build segment list, only u < v to avoid duplicates
//     const segments = [];
//     for (let u = 0; u < N2; u++) {
//       const ucoord = coords[u];
//       for (let e = offsets[u]; e < offsets[u+1]; e++) {
//         const v = neighbors[e];
//         if (v > u) {
//           const vcoord = coords[v];
//           segments.push([
//             [ucoord.lat, ucoord.lon],
//             [vcoord.lat, vcoord.lon]
//           ]);
//         }
//       }
//     }

//     // 4) Return JSON
//     res.json({ segments });
//   }
//   catch (err) {
//     console.error('Error in /all:', err);
//     res.status(500).json({ error: err.message });
//   }
// });

app.listen(3000, ()=> console.log('Server on http://localhost:3000'));
