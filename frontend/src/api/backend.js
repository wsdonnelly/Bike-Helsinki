import { API } from "./http";

/** Snap a lat/lon to the nearest graph node. */
export async function snapToGraph(lat, lon) {
  const { data } = await API.get("/snap", { params: { lat, lon } });
  return data; // { idx, lat, lon }
}

/** Request a route between node indices. */
export async function getRoute({ startIdx, endIdx, options = {} }) {
  const { data } = await API.post("/route", {
    startIdx,
    endIdx,
    ...options, // { bikeSurfaceMask, speeds, penalties, factors... }
  });
  return data; // { path, coords, modes, distanceM, durationS, ... }
}

/** Get Helsinki bbox/viewbox for Nominatim. */
export async function getHelsinkiConfig() {
  const { data } = await API.get("/config/helsinki");
  return data; // { bbox, viewbox, viewboxString }
}

/** Meta/health (keeps your /meta fallback behavior). */
export async function getMeta() {
  try {
    const { data } = await API.get("/meta");
    return data;
  } catch {
    const { data } = await API.get("/healthz");
    return {
      ok: data.ok,
      totalNodes: data.totalNodes,
      defaults: undefined,
      addons: data.addons,
    };
  }
}

/** Simple ping for app load. */
export async function ping() {
  try {
    const { data } = await API.get("/healthz");
    return !!data?.ok;
  } catch {
    return false;
  }
}
