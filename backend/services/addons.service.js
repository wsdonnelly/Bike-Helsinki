let kdSnap = null;
let router = null;
let graphInfo = null;
let kdSnapGraphInfo = null;
let LAT = null,
  LON = null;

try {
  router = require("../bindings/build/Release/route.node");
  if (router?.getGraphInfo) {
    graphInfo = Object.freeze({ ...router.getGraphInfo() });
    console.log("Graph info:", graphInfo);
    if (graphInfo?.nodesPath) {
      process.env.BIKEMAP_GRAPH_NODES_PATH = graphInfo.nodesPath;
    }
  }
  kdSnap = require("../bindings/build/Release/kd_snap.node");
  console.log("Native addons loaded");
} catch (err) {
  console.warn("Native addons not found:", err?.message || err);
}

if (kdSnap) {
  try {
    kdSnapGraphInfo = kdSnap.getGraphInfo
      ? Object.freeze({ ...kdSnap.getGraphInfo() })
      : null;
    LAT = kdSnap.getLatArray();
    LON = kdSnap.getLonArray();
    console.log(
      "LAT/LON typed arrays:",
      LAT?.constructor?.name,
      LAT?.length,
      LON?.length
    );
    if (kdSnapGraphInfo) {
      console.log("kdSnap graph info:", kdSnapGraphInfo);
    }
  } catch (e) {
    console.warn("Failed to initialize kdSnap metadata:", e?.message || e);
  }
}

function hasKdSnap() {
  return !!kdSnap;
}
function hasRouter() {
  return !!router;
}
function getKdSnap() {
  return kdSnap;
}
function getRouter() {
  return router;
}
function getTypedArrays() {
  return { LAT, LON };
}
function getGraphInfo() {
  return graphInfo;
}
function getKdSnapGraphInfo() {
  return kdSnapGraphInfo;
}

module.exports = {
  hasKdSnap,
  hasRouter,
  getKdSnap,
  getRouter,
  getTypedArrays,
  getGraphInfo,
  getKdSnapGraphInfo,
};
