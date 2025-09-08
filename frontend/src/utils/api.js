// frontend/src/utils/api.js
import axios from "axios";

// For single-service deployment: API and frontend served from same origin
// In development: use localhost:3000
// In production: use relative URLs (same origin as frontend)
const BASE_URL = import.meta.env.DEV
  ? 'http://localhost:3000'  // Development
  : '';                      // Production (relative URLs)

export const API = axios.create({ baseURL: BASE_URL });

export const ALL_SURFACES = 0xffff; //needed?

/**
 * Snap a lat/lon to the nearest graph node.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{ idx:number, lat:number, lon:number }>}
 */
export async function snapToGraph(lat, lon) {
  const { data } = await API.get("/snap", { params: { lat, lon } });
  return data; // { idx, lat, lon }
}

/**
 * Request a route (two-mode A*) between node indices.
 * Server returns indices AND coords so you don’t have to map on the client.
 *
 * @param {object} params
 * @param {number} params.startIdx - start node index
 * @param {number} params.endIdx   - end node index
 * @param {object} [params.options] - optional routing options to override server defaults
 *   {
 *     bikeSurfaceMask?: number,
 *     bikeSpeedMps?: number,   walkSpeedMps?: number,
 *     rideToWalkPenaltyS?: number, walkToRidePenaltyS?: number,
 *     bikeSurfaceFactor?: number[], walkSurfaceFactor?: number[]
 *   }
 * @returns {Promise<{
 *   path:number[],                      // node indices (kept for debugging/future)
 *   coords:[number,number][],           // [[lat,lon], ...] aligned with path
 *   modes:number[],                     // [1|2] per segment
 *   distanceM:number,
 *   durationS:number,
 *   distanceBike,
 *   distanceWalk,
 *   startCoord?:[number,number],
 *   endCoord?:[number,number]
 * }>}
 */
export async function getRoute({ startIdx, endIdx, options = {} }) {
  const { data } = await API.post("/route", {
    startIdx,
    endIdx,
    // optional per-request overrides (masks/speeds)
    ...options,
  });
  // data: { path, coords, modes, distanceM, durationS, distanceBike, distanceWalk, startCoord, endCoord }
  return data;
}

/**
 * Update server-side routing defaults.
 * Useful for toggling masks/speeds globally without passing options every time.
 *
 * Pass any subset of:
 * {
 *   bikeSurfaceMask?: number,
 *   bikeSpeedMps?: number,    walkSpeedMps?: number,
 *   rideToWalkPenaltyS?: number, walkToRidePenaltyS?: number,
 *   bikeSurfaceFactor?: number[], walkSurfaceFactor?: number[]
 * }
 *
 * @param {object} defaultsPatch
 * @returns {Promise<void>}
 */
export async function setRoutingDefaults(defaultsPatch) {
  await API.post("/filter", defaultsPatch);
}

// /**
//  * Convenience helper to set the same mask for both bike & walk.
//  * @param {number} mask
//  * @returns {Promise<void>}
//  */
// export async function setSurfaceMaskBoth(mask) {
//   // Example server expects { bikeSurfaceMask }
//   await API.post('/filter', { bikeSurfaceMask: mask });
// }
export async function setBikeSurfaceMask(mask) {
  await API.post("/filter", { bikeSurfaceMask: mask });
}

/**
 * Get meta info (e.g., totalNodes, server defaults).
 * @returns {Promise<{ totalNodes:number, defaults:object }>}
 */
export async function getMeta() {
  return API.get("/meta").then((res) => res.data);
}
