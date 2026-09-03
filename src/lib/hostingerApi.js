let csrfToken = "";

async function readJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("The Studio API is not available on this server.");
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || "The Studio API request failed.");
    error.status = response.status;
    throw error;
  }
  if (payload.csrfToken) csrfToken = payload.csrfToken;
  return payload;
}

async function request(action, options = {}, params = {}) {
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (csrfToken && options.method && options.method !== "GET") headers["X-CSRF-Token"] = csrfToken;
  const search = new URLSearchParams({ action, ...params });
  const response = await fetch(`/api/index.php?${search}`, { credentials: "same-origin", ...options, headers });
  return readJson(response);
}

export async function getApiStatus() {
  try {
    const response = await fetch("/api/index.php?action=status", { headers: { Accept: "application/json" }, credentials: "same-origin" });
    if (!(response.headers.get("content-type") || "").includes("application/json")) return { available: false, configured: false };
    const payload = await response.json();
    return { available: true, configured: response.ok && payload.configured === true };
  } catch {
    return { available: false, configured: false };
  }
}

export async function getSession() {
  const payload = await request("session");
  return payload.authenticated ? payload.user : null;
}

export async function login(email, password) {
  const payload = await request("login", { method: "POST", body: JSON.stringify({ email, password }) });
  return payload.user;
}

export async function logout() {
  await request("logout", { method: "POST", body: "{}" });
  csrfToken = "";
}

export async function apiGet(action, params) {
  return request(action, {}, params);
}

export async function apiPost(action, body, params) {
  return request(action, { method: "POST", body: JSON.stringify(body) }, params);
}

export async function apiPatch(action, body, params) {
  return request(action, { method: "PATCH", body: JSON.stringify(body) }, params);
}

export async function apiUpload(action, formData) {
  return request(action, { method: "POST", body: formData });
}

export async function apiDelete(action, body) {
  return request(action, { method: "DELETE", body: JSON.stringify(body) });
}
