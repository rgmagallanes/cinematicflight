const BOOKING_PATH = "/api/bookings";
const DEFAULT_HEADER_NAME = "X-Cinematic-Flight-Webhook-Key";
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 16 * 1024;
const ALLOWED_PURPOSES = new Set([
  "Photograph reading",
  "New property website",
  "Add the cinematic experience",
]);

const bookingSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS booking_requests (
    request_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    status_code INTEGER,
    response_json TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_booking_requests_expires_at
    ON booking_requests(expires_at)`,
  `CREATE TABLE IF NOT EXISTS booking_rate_limits (
    fingerprint TEXT PRIMARY KEY,
    window_started INTEGER NOT NULL,
    request_count INTEGER NOT NULL
  )`,
];

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function validateBookingPayload(input) {
  const payload = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const booking = {
    requestId: cleanText(payload.requestId, 100),
    name: cleanText(payload.name, 100),
    email: cleanText(payload.email, 254).toLowerCase(),
    property: cleanText(payload.property, 160),
    purpose: cleanText(payload.purpose, 80),
    start: cleanText(payload.start, 40),
    end: cleanText(payload.end, 40),
    timezone: cleanText(payload.timezone, 60),
  };
  const errors = [];
  if (!/^booking_[a-zA-Z0-9_-]{8,90}$/.test(booking.requestId)) errors.push("A valid request ID is required.");
  if (!booking.name) errors.push("Name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email)) errors.push("A valid email is required.");
  if (!ALLOWED_PURPOSES.has(booking.purpose)) errors.push("Choose a valid conversation type.");
  if (booking.timezone !== "Asia/Manila") errors.push("The booking timezone must be Asia/Manila.");

  const start = new Date(booking.start);
  const end = new Date(booking.end);
  if (!booking.start || Number.isNaN(start.getTime())) errors.push("A valid start time is required.");
  if (!booking.end || Number.isNaN(end.getTime()) || end <= start) errors.push("A valid end time is required.");
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() - start.getTime() !== 30 * 60 * 1000) {
    errors.push("Bookings must be 30 minutes.");
  }

  return { booking, errors };
}

async function fingerprintRequest(request, secret) {
  const forwarded = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  const bytes = new TextEncoder().encode(`${secret}:${forwarded}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureD1Schema(db) {
  await db.batch(bookingSchemaStatements.map((statement) => db.prepare(statement)));
}

function createD1Store(db) {
  return {
    async get(requestId, now) {
      const record = await db.prepare(
        "SELECT status, status_code, response_json, expires_at FROM booking_requests WHERE request_id = ?",
      ).bind(requestId).first();
      if (!record) return null;
      if (Number(record.expires_at) <= now) {
        await db.prepare("DELETE FROM booking_requests WHERE request_id = ?").bind(requestId).run();
        return null;
      }
      return {
        status: record.status,
        statusCode: record.status_code,
        response: record.response_json ? JSON.parse(record.response_json) : null,
      };
    },
    async claim(requestId, now) {
      const result = await db.prepare(
        `INSERT OR IGNORE INTO booking_requests
          (request_id, status, created_at, expires_at)
          VALUES (?, 'processing', ?, ?)`,
      ).bind(requestId, now, now + IDEMPOTENCY_TTL_MS).run();
      return Number(result.meta?.changes || 0) === 1;
    },
    async complete(requestId, statusCode, response) {
      await db.prepare(
        "UPDATE booking_requests SET status = 'done', status_code = ?, response_json = ? WHERE request_id = ?",
      ).bind(statusCode, JSON.stringify(response), requestId).run();
    },
    async release(requestId) {
      await db.prepare("DELETE FROM booking_requests WHERE request_id = ? AND status = 'processing'").bind(requestId).run();
    },
    async incrementRate(fingerprint, now) {
      const cutoff = now - RATE_WINDOW_MS;
      const record = await db.prepare(
        `INSERT INTO booking_rate_limits (fingerprint, window_started, request_count)
          VALUES (?, ?, 1)
          ON CONFLICT(fingerprint) DO UPDATE SET
            request_count = CASE WHEN booking_rate_limits.window_started <= ? THEN 1 ELSE booking_rate_limits.request_count + 1 END,
            window_started = CASE WHEN booking_rate_limits.window_started <= ? THEN excluded.window_started ELSE booking_rate_limits.window_started END
          RETURNING request_count`,
      ).bind(fingerprint, now, cutoff, cutoff).first();
      return Number(record?.request_count || 1);
    },
  };
}

export function createMemoryBookingStore() {
  const requests = new Map();
  const rates = new Map();
  return {
    async get(requestId, now) {
      const record = requests.get(requestId);
      if (!record) return null;
      if (record.expiresAt <= now) {
        requests.delete(requestId);
        return null;
      }
      return record;
    },
    async claim(requestId, now) {
      if (requests.has(requestId)) return false;
      requests.set(requestId, { status: "processing", expiresAt: now + IDEMPOTENCY_TTL_MS });
      return true;
    },
    async complete(requestId, statusCode, response) {
      const record = requests.get(requestId);
      requests.set(requestId, { ...record, status: "done", statusCode, response });
    },
    async release(requestId) {
      if (requests.get(requestId)?.status === "processing") requests.delete(requestId);
    },
    async incrementRate(fingerprint, now) {
      const record = rates.get(fingerprint);
      if (!record || record.windowStarted <= now - RATE_WINDOW_MS) {
        rates.set(fingerprint, { windowStarted: now, count: 1 });
        return 1;
      }
      record.count += 1;
      return record.count;
    },
  };
}

function safeUpstreamUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  } catch {
    return false;
  }
}

function narrowUpstreamBody(body, fallbackRequestId) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const narrowed = {
    ok: Boolean(body.ok),
    code: cleanText(body.code, 60),
    requestId: cleanText(body.requestId, 100) || fallbackRequestId,
  };
  for (const field of ["eventId", "start", "end", "timezone", "message"]) {
    if (typeof body[field] === "string") narrowed[field] = cleanText(body[field], field === "message" ? 300 : 100);
  }
  if (Array.isArray(body.errors)) narrowed.errors = body.errors.slice(0, 8).map((error) => cleanText(error, 180)).filter(Boolean);
  return narrowed;
}

export async function handleBookingRequest(request, env, dependencies = {}) {
  if (request.method !== "POST") return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405, { allow: "POST" });

  const webhookUrl = cleanText(env.BOOKING_N8N_WEBHOOK_URL, 500);
  const webhookKey = cleanText(env.BOOKING_N8N_WEBHOOK_KEY, 500);
  const headerName = cleanText(env.BOOKING_N8N_HEADER_NAME, 100) || DEFAULT_HEADER_NAME;
  if (!webhookUrl || !webhookKey || !safeUpstreamUrl(webhookUrl)) {
    return jsonResponse({ ok: false, code: "BOOKING_NOT_CONFIGURED", message: "Online booking is temporarily unavailable." }, 503);
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return jsonResponse({ ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403);

  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > MAX_BODY_BYTES) return jsonResponse({ ok: false, code: "PAYLOAD_TOO_LARGE" }, 413);

  let input;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) throw new Error("large");
    input = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, code: "INVALID_JSON", message: "The booking details could not be read." }, 400);
  }

  if (cleanText(input.website, 200)) return jsonResponse({ ok: true, code: "BOOKING_RECEIVED" }, 202);

  const { booking, errors } = validateBookingPayload(input);
  if (errors.length) return jsonResponse({ ok: false, code: "INVALID_BOOKING", errors }, 422);

  let store = dependencies.store;
  if (!store) {
    if (!env.DB) return jsonResponse({ ok: false, code: "BOOKING_STORAGE_UNAVAILABLE", message: "Online booking is temporarily unavailable." }, 503);
    await ensureD1Schema(env.DB);
    store = createD1Store(env.DB);
  }

  const now = dependencies.now ? dependencies.now() : Date.now();
  const existing = await store.get(booking.requestId, now);
  if (existing?.status === "done") return jsonResponse(existing.response, existing.statusCode || 200, { "x-booking-idempotent": "true" });
  if (existing?.status === "processing") {
    return jsonResponse({ ok: false, code: "BOOKING_IN_PROGRESS", message: "This booking is already being processed." }, 409);
  }

  const fingerprint = await fingerprintRequest(request, webhookKey);
  const rateCount = await store.incrementRate(fingerprint, now);
  if (rateCount > RATE_LIMIT) {
    return jsonResponse({ ok: false, code: "RATE_LIMITED", message: "Please wait before trying again." }, 429, { "retry-after": "600" });
  }

  if (!await store.claim(booking.requestId, now)) {
    return jsonResponse({ ok: false, code: "BOOKING_IN_PROGRESS", message: "This booking is already being processed." }, 409);
  }

  try {
    const fetcher = dependencies.fetcher || fetch;
    const upstream = await fetcher(webhookUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        [headerName]: webhookKey,
      },
      body: JSON.stringify(booking),
      signal: AbortSignal.timeout(15000),
    });

    let upstreamBody = null;
    try { upstreamBody = await upstream.json(); } catch {}

    const responseBody = narrowUpstreamBody(upstreamBody, booking.requestId);
    if (!responseBody || upstream.status >= 500 || [401, 403].includes(upstream.status)) {
      await store.release(booking.requestId);
      return jsonResponse({ ok: false, code: "BOOKING_PROVIDER_ERROR", message: "The booking could not be completed. Please try again." }, 502);
    }

    const status = [200, 201, 202, 409, 422].includes(upstream.status) ? upstream.status : 502;
    if (status === 502) {
      await store.release(booking.requestId);
      return jsonResponse({ ok: false, code: "BOOKING_PROVIDER_ERROR", message: "The booking could not be completed. Please try again." }, 502);
    }
    await store.complete(booking.requestId, status, responseBody);
    return jsonResponse(responseBody, status);
  } catch {
    await store.release(booking.requestId);
    return jsonResponse({ ok: false, code: "BOOKING_PROVIDER_UNAVAILABLE", message: "The booking service did not respond. Please try again." }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === BOOKING_PATH) return handleBookingRequest(request, env);

    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) return response;

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
