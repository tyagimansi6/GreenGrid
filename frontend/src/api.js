const RENDER_API = "https://greengrid-871p.onrender.com";

function apiBase() {
  const configured = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
  const local = !configured || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured);
  // Vite inlines VITE_API_URL at build time. The dev server proxies /api to
  // localhost; a production bundle must not, or the browser sits on (pending).
  if (import.meta.env.PROD && local) return RENDER_API;
  return configured;
}

const BASE = apiBase();

export class ApiError extends Error {
  constructor(message, payload) {
    super(message);
    this.name = "ApiError";
    this.payload = payload;
  }
}

function messageFrom(payload, status) {
  if (!payload) return `Request failed (${status}).`;
  if (typeof payload.detail === "string") return payload.detail;
  if (Array.isArray(payload.non_field_errors)) return payload.non_field_errors.join(" ");
  if (typeof payload === "object") {
    return Object.entries(payload)
      .map(([key, value]) => `${key}: ${[].concat(value).join(" ")}`)
      .join(" ");
  }
  return `Request failed (${status}).`;
}

async function request(path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  let response;
  try {
    response = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("The browser could not reach the GreenGrid API.");
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    throw new ApiError(messageFrom(payload, response.status), payload);
  }
  return payload;
}

export const api = {
  dashboard: () => request("/api/dashboard/"),
  facilities: () => request("/api/facilities/"),
  facility: (code) => request(`/api/facilities/${code}/`),
  updateFacility: (code, body) =>
    request(`/api/facilities/${code}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  alerts: () => request("/api/alerts/"),
  billing: () => request("/api/billing/"),
  renewables: () => request("/api/renewables/"),
  forecast: (facilityId, telemetry) => {
    const params = new URLSearchParams();
    Object.entries(telemetry || {}).forEach(([key, value]) => {
      if (value != null && value !== "") params.set(key, String(value));
    });
    return request(`/api/forecast/${facilityId}/?${params}`);
  },
};
