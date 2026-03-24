import axios from "axios";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

const client = axios.create({
  baseURL: NOMINATIM_BASE,
  timeout: 15_000,
});

export async function searchNominatim({
  q,
  viewbox,
  bounded = true,
  lang = "fi",
  limit = 5,
  country = "fi",
  signal,
} = {}) {
  const params = {
    q,
    format: "jsonv2",
    limit,
    addressdetails: 1,
    dedupe: 1,
    "accept-language": lang,
  };
  if (country) params.countrycodes = country;
  if (viewbox) {
    params.viewbox = viewbox;
    if (bounded) params.bounded = 1;
  }
  const email = (import.meta.env.VITE_NOMINATIM_EMAIL || "").trim();
  if (email) params.email = email;

  const res = await client.get("/search", { params, signal });
  return res.data;
}

export async function reverseNominatim({ lat, lon, zoom = 18, lang = "fi", signal } = {}) {
  const params = {
    lat,
    lon,
    zoom,
    format: "jsonv2",
    "accept-language": lang,
  };
  const email = (import.meta.env.VITE_NOMINATIM_EMAIL || "").trim();
  if (email) params.email = email;

  const res = await client.get("/reverse", { params, signal });
  return res.data;
}
