// frontend/src/utils/api.js
import axios from "axios";

/**
 * Resolve API base URL:
 * - Dev: http://localhost:3000
 * - Prod: use VITE_API_URL if set (Render Static Site → Environment tab)
 * - (Optional) If you configure a static-site rewrite proxy to your API,
 *   you can set VITE_API_URL to "/api" and keep everything same-origin.
 */
function resolveBaseURL() {
  const envUrl = (import.meta.env.VITE_API_URL || "").trim();
  if (envUrl) return envUrl; // absolute like "https://<api>.onrender.com" or relative like "/api"
  if (import.meta.env.DEV) return "http://localhost:3000";
  // Fallback: relative origin (only works if you added a rewrite proxy)
  return "";
}

export const API = axios.create({
  baseURL: resolveBaseURL(),
  timeout: 15000,
});

// Optional: small error normalizer
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 503) {
      err.userMessage =
        "Service temporarily unavailable (warming up or building). Try again in a moment.";
    } else if (status === 400) {
      err.userMessage = "Invalid request. Please check your inputs.";
    } else {
      err.userMessage =
        "Request failed. Please try again. If this persists, check your connection.";
    }
    throw err;
  }
);

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
  return data; // { path, coords, modes, distanceM, durationS, distanceBike, distanceWalk, startCoord, endCoord }
}

/**
 * Get meta/health info.
 * - If /meta exists on your server, we'll use it.
 * - Otherwise we fall back to /healthz (which you already added).
 */
export async function getMeta() {
  try {
    const { data } = await API.get("/meta");
    return data;
  } catch (e) {
    // Fall back to health endpoint
    const { data } = await API.get("/healthz");
    return {
      ok: data.ok,
      totalNodes: data.totalNodes,
      defaults: undefined, // not provided by /healthz
      addons: data.addons,
    };
  }
}

/** Simple “is the API alive?” ping you can call on app load. */
export async function ping() {
  try {
    const { data } = await API.get("/healthz");
    return !!data?.ok;
  } catch {
    return false;
  }
}
