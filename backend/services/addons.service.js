let kdSnap = null;
let router = null;
let LAT = null,
  LON = null;

try {
  kdSnap = require("../bindings/build/Release/kd_snap.node");
  router = require("../bindings/build/Release/route.node");
  console.log("Native addons loaded");
} catch (err) {
  console.warn("Native addons not found:", err?.message || err);
}

if (kdSnap) {
  try {
    LAT = kdSnap.getLatArray();
    LON = kdSnap.getLonArray();
    console.log(
      "LAT/LON typed arrays:",
      LAT?.constructor?.name,
      LAT?.length,
      LON?.length
    );
  } catch (e) {
    console.warn("Failed to get typed arrays:", e?.message || e);
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

module.exports = {
  hasKdSnap,
  hasRouter,
  getKdSnap,
  getRouter,
  getTypedArrays,
};
