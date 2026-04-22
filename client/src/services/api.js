// ─── API Service ─────────────────────────────────────────────
// Centralized fetch helper with JWT auth headers

const BASE_URL = `https://${window.location.hostname}:5001`;

// ─── Token helpers ───────────────────────────────────────────
export const getToken = () => localStorage.getItem("vl_token");
export const setToken = (t) => localStorage.setItem("vl_token", t);
export const clearToken = () => localStorage.removeItem("vl_token");
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("vl_user") || "null");
  } catch {
    return null;
  }
};
export const setUser = (u) => localStorage.setItem("vl_user", JSON.stringify(u));
export const clearUser = () => localStorage.removeItem("vl_user");

// ─── Core fetch wrapper ──────────────────────────────────────
const apiFetch = async (path, options = {}) => {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

// ═══════════════════════════════════════════════════════════
//  AUTH API
// ═══════════════════════════════════════════════════════════

export const authAPI = {
  register: (username, password) =>
    apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  login: (username, password) =>
    apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  verify: () => apiFetch("/api/auth/verify"),
};

// ═══════════════════════════════════════════════════════════
//  ROOMS API
// ═══════════════════════════════════════════════════════════

export const roomsAPI = {
  list: () => apiFetch("/api/rooms"),
  create: (name) => apiFetch("/api/rooms", { method: "POST", body: JSON.stringify({ name }) }),
  get: (id) => apiFetch(`/api/rooms/${id}`),
};
