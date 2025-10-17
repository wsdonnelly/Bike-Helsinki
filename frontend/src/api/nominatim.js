const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

/**
 * Forward geocoding (address -> coords). Optionally bounded by viewbox.
 * @param {Object} opts
 * @param {string} opts.q - Query text
 * @param {string} [opts.viewbox] - "<left>,<top>,<right>,<bottom>"
 * @param {boolean} [opts.bounded=true] - Restrict to viewbox
 * @param {string} [opts.lang='fi']
 * @param {number} [opts.limit=5]
 * @param {string} [opts.country='fi'] - country code filter
 */
export async function searchNominatim({
  q,
  viewbox,
  bounded = true,
  lang = "fi",
  limit = 5,
  country = "fi",
} = {}) {
  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    limit: String(limit),
    addressdetails: "1",
    dedupe: "1",
    "accept-language": lang,
  });
  if (country) params.set("countrycodes", country);
  if (viewbox) {
    params.set("viewbox", viewbox);
    if (bounded) params.set("bounded", "1");
  }
  const email = (import.meta.env.VITE_NOMINATIM_EMAIL || "").trim();
  if (email) params.set("email", email);

  const res = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`);
  if (!res.ok) throw new Error("Nominatim search failed");
  return res.json();
}

/**
 * Reverse geocoding (coords -> address).
 * @param {Object} opts
 * @param {number} opts.lat
 * @param {number} opts.lon
 * @param {number} [opts.zoom=18]
 * @param {string} [opts.lang='fi']
 */
export async function reverseNominatim({ lat, lon, zoom = 18, lang = "fi" }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    zoom: String(zoom),
    format: "jsonv2",
    "accept-language": lang,
  });
  const email = (import.meta.env.VITE_NOMINATIM_EMAIL || "").trim();
  if (email) params.set("email", email);

  const res = await fetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`);
  if (!res.ok) throw new Error("Nominatim reverse failed");
  return res.json();
}
