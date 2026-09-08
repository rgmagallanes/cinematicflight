import assert from "node:assert/strict";
import test from "node:test";
import { ConfirmedIngestError, runManualWebsiteResearch, type ResearchTransport } from "../src/index.ts";

const transport: ResearchTransport = {
  async resolve() { return ["93.184.216.34"]; },
  async fetch({ url }) {
    if (url.pathname === "/robots.txt") return { status: 404, headers: { "content-type": "text/plain" }, body: "" };
    if (url.pathname === "/") return { status: 200, headers: { "content-type": "text/html" }, body: "<title>Harbour House</title><a href='/gallery'>Gallery</a>" };
    return { status: 200, headers: { "content-type": "text/html" }, body: "<title>Gallery</title>" };
  },
};

const baseInput = { transport, missionPublicId: "mission_123", prospectPublicId: "prospect_123", requestedUrl: "https://harbour.example/", idempotencyKey: "research-key-123" };

test("manual runner creates, researches fixtures, and persists one signed-ingest payload", async () => {
  const calls: { operation: string; payload: Record<string, unknown> }[] = [];
  const result = await runManualWebsiteResearch({ ...baseInput, ingest: async (operation, payload) => {
    calls.push({ operation, payload });
    if (operation === "CREATE_RUN") return { run: { public_id: "run_123" } };
    if (operation === "PERSIST_WEBSITE_RESEARCH") return { research: { public_id: "research_123", status: "COMPLETED", stop_reason: "RESEARCH_COMPLETE" } };
    throw new Error(`Unexpected operation ${operation}`);
  } });
  assert.deepEqual(calls.map((call) => call.operation), ["CREATE_RUN", "PERSIST_WEBSITE_RESEARCH"]);
  assert.equal(calls[1].payload.run_public_id, "run_123");
  assert.equal(calls[1].payload.idempotency_key, "research-key-123");
  assert.equal(calls[1].payload.stop_reason, "RESEARCH_COMPLETE");
  assert.equal(result.persisted.research.public_id, "research_123");
});

test("a confirmed rejected persistence request terminally records tool failure", async () => {
  const calls: { operation: string; payload: Record<string, unknown> }[] = [];
  await assert.rejects(() => runManualWebsiteResearch({ ...baseInput, ingest: async (operation, payload) => {
    calls.push({ operation, payload });
    if (operation === "CREATE_RUN") return { run: { public_id: "run_456" } };
    if (operation === "PERSIST_WEBSITE_RESEARCH") throw new ConfirmedIngestError("Payload rejected.");
    if (operation === "UPDATE_RUN") return { run: { public_id: "run_456", status: "FAILED" } };
    throw new Error(`Unexpected operation ${operation}`);
  } }), ConfirmedIngestError);
  assert.deepEqual(calls.map((call) => call.operation), ["CREATE_RUN", "PERSIST_WEBSITE_RESEARCH", "UPDATE_RUN"]);
  assert.equal(calls[2].payload.run_public_id, "run_456");
  assert.equal(calls[2].payload.status, "FAILED");
  assert.equal(calls[2].payload.stop_reason, "TOOL_FAILURE");
  assert.equal(calls[2].payload.llm_call_count, 0);
  assert.equal(typeof calls[2].payload.step_count, "number");
  assert.ok(Number(calls[2].payload.step_count) > 0);
});

test("an ambiguous ingest failure is not allowed to overwrite a potentially completed run", async () => {
  const calls: string[] = [];
  await assert.rejects(() => runManualWebsiteResearch({ ...baseInput, ingest: async (operation) => {
    calls.push(operation);
    if (operation === "CREATE_RUN") return { run: { public_id: "run_789" } };
    throw new Error("Connection reset.");
  } }), /Connection reset/);
  assert.deepEqual(calls, ["CREATE_RUN", "PERSIST_WEBSITE_RESEARCH"]);
});
