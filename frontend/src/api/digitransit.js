import axios from "axios";

const client = axios.create({
  baseURL: "https://api.digitransit.fi/geocoding/v1/",
  timeout: 15_000,
  headers: {
    "digitransit-subscription-key": import.meta.env.VITE_DIGITRANSIT_KEY ?? "",
  },
});

function normalizeFeature(feature) {
  const p = feature.properties;
  const [lon, lat] = feature.geometry.coordinates;
  return {
    place_id: p.id || p.gid,
    display_name: p.label,
    lat: String(lat),
    lon: String(lon),
    address: {
      house_number: p.housenumber,
      road: p.street,
      neighbourhood: p.neighbourhood,
      city: p.locality || p.localadmin,
      municipality: p.localadmin,
      county: p.county,
    },
  };
}

export async function searchAddresses({
  q,
  viewbox,
  bounded = true,
  lang = "fi",
  limit = 5,
  signal,
} = {}) {
  const params = { text: q, size: limit, lang, "boundary.country": "FIN" };
  if (viewbox && bounded) {
    const [minLon, maxLat, maxLon, minLat] = viewbox.split(",").map(Number);
    params["boundary.rect.min_lon"] = minLon;
    params["boundary.rect.max_lat"] = maxLat;
    params["boundary.rect.max_lon"] = maxLon;
    params["boundary.rect.min_lat"] = minLat;
  }
  const res = await client.get("/search", { params, signal });
  return res.data.features.map(normalizeFeature);
}

export async function reverseGeocode({ lat, lon, lang = "fi", signal } = {}) {
  const params = { "point.lat": lat, "point.lon": lon, size: 1, lang };
  const res = await client.get("/reverse", { params, signal });
  return normalizeFeature(res.data.features[0]);
}
