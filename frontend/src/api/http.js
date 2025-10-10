import axios from "axios";

/** Resolve API base URL */
function resolveBaseURL() {
  const envUrl = (import.meta.env.VITE_API_URL || "").trim();
  if (envUrl) return envUrl; // e.g. "https://api.onrender.com" or "/api"
  if (import.meta.env.DEV) return "http://localhost:3000";
  return ""; // same-origin (only if you proxy/rewrite)
}

export const API = axios.create({
  baseURL: resolveBaseURL(),
  timeout: 15_000,
});

// Normalize common errors -> err.userMessage
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 503) {
      err.userMessage =
        "Service temporarily unavailable (warming up or building). Try again shortly.";
    } else if (status === 400) {
      err.userMessage = "Invalid request. Please check your inputs.";
    } else {
      err.userMessage =
        "Request failed. Please try again. If it persists, check your connection.";
    }
    return Promise.reject(err);
  }
);
