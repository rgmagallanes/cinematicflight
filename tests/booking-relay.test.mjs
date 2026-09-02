import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryBookingStore, handleBookingRequest, validateBookingPayload } from "../worker/index.js";

const env = {
  BOOKING_N8N_WEBHOOK_URL: "https://n8n.example.test/webhook/cinematic-flight/prospect-booking",
  BOOKING_N8N_WEBHOOK_KEY: "private-test-key",
  BOOKING_N8N_HEADER_NAME: "X-Cinematic-Flight-Webhook-Key",
};

function payload(requestId = "booking_test_20260901_001") {
  return {
    requestId,
    name: "Richard Test",
    email: "richard@example.com",
    property: "Test Property",
    purpose: "Photograph reading",
    start: "2026-09-05T10:00:00+08:00",
    end: "2026-09-05T10:30:00+08:00",
    timezone: "Asia/Manila",
    website: "",
  };
}

function request(body, headers = {}) {
  return new Request("https://cinematicflight.com/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.5", ...headers },
    body: JSON.stringify(body),
  });
}

test("requires name, email, an allowed purpose, and a 30-minute Manila window", () => {
  const invalid = payload();
  invalid.name = "";
  invalid.email = "not-an-email";
  invalid.purpose = "Anything";
  invalid.end = "2026-09-05T11:00:00+08:00";
  invalid.timezone = "UTC";
  const { errors } = validateBookingPayload(invalid);
  assert.match(errors.join(" "), /Name is required/);
  assert.match(errors.join(" "), /valid email/);
  assert.match(errors.join(" "), /valid conversation/);
  assert.match(errors.join(" "), /30 minutes/);
  assert.match(errors.join(" "), /Asia\/Manila/);
});

test("forwards a normalized booking with private header auth", async () => {
  let forwarded;
  const response = await handleBookingRequest(request(payload()), env, {
    store: createMemoryBookingStore(),
    fetcher: async (url, options) => {
      forwarded = { url, options, body: JSON.parse(options.body) };
      return Response.json({ ok: true, code: "BOOKING_CONFIRMED", requestId: payload().requestId, eventId: "calendar-123" }, { status: 201 });
    },
  });

  assert.equal(response.status, 201);
  assert.equal(forwarded.url, env.BOOKING_N8N_WEBHOOK_URL);
  assert.equal(forwarded.options.headers[env.BOOKING_N8N_HEADER_NAME], env.BOOKING_N8N_WEBHOOK_KEY);
  assert.equal(forwarded.body.email, "richard@example.com");
  assert.equal("website" in forwarded.body, false);
});

test("replays a completed request without creating a duplicate", async () => {
  const store = createMemoryBookingStore();
  let fetchCalls = 0;
  const dependencies = {
    store,
    fetcher: async () => {
      fetchCalls += 1;
      return Response.json({ ok: true, code: "BOOKING_CONFIRMED", requestId: payload().requestId }, { status: 201 });
    },
  };

  const first = await handleBookingRequest(request(payload()), env, dependencies);
  const second = await handleBookingRequest(request(payload()), env, dependencies);
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(second.headers.get("x-booking-idempotent"), "true");
  assert.equal(fetchCalls, 1);
});

test("rate limits the sixth unique request from one client", async () => {
  const store = createMemoryBookingStore();
  const dependencies = {
    store,
    fetcher: async (_url, options) => Response.json({ ok: true, code: "BOOKING_CONFIRMED", requestId: JSON.parse(options.body).requestId }, { status: 201 }),
  };
  for (let index = 0; index < 5; index += 1) {
    const response = await handleBookingRequest(request(payload(`booking_rate_test_${index}`)), env, dependencies);
    assert.equal(response.status, 201);
  }
  const limited = await handleBookingRequest(request(payload("booking_rate_test_5")), env, dependencies);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "600");
});

test("rejects cross-origin requests and missing server configuration", async () => {
  const crossOrigin = await handleBookingRequest(request(payload(), { origin: "https://attacker.example" }), env, { store: createMemoryBookingStore() });
  assert.equal(crossOrigin.status, 403);

  const notConfigured = await handleBookingRequest(request(payload()), {}, { store: createMemoryBookingStore() });
  assert.equal(notConfigured.status, 503);
});

test("does not call the provider for invalid input", async () => {
  let called = false;
  const invalid = payload();
  invalid.email = "bad";
  const response = await handleBookingRequest(request(invalid), env, {
    store: createMemoryBookingStore(),
    fetcher: async () => { called = true; return Response.json({}); },
  });
  assert.equal(response.status, 422);
  assert.equal(called, false);
});
