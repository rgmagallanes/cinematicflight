#!/usr/bin/env node
// Manual Phase 6 runner. It is intentionally not a server, scheduler, browser API,
// or autonomous loop. It uses only the configured signed internal ingest boundary.
import { randomUUID } from "node:crypto";
import { createPinnedHttpsTransport } from "../services/prospecting-agent/src/website-research.ts";
import { ConfirmedIngestError, runManualWebsiteResearch } from "../services/prospecting-agent/src/manual-website-research-runner.ts";

const required = ["PROSPECTING_AGENT_ENDPOINT", "PROSPECTING_AGENT_TOKEN", "PROSPECTING_WEBSITE_URL"];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required.`);
const endpoint = new URL(process.env.PROSPECTING_AGENT_ENDPOINT);
if (endpoint.protocol !== "https:" && endpoint.hostname !== "127.0.0.1" && endpoint.hostname !== "localhost") throw new Error("The internal ingest endpoint must use HTTPS outside local testing.");
const token = process.env.PROSPECTING_AGENT_TOKEN;
if (!/^[0-9a-f]{64}$/.test(token)) throw new Error("PROSPECTING_AGENT_TOKEN must be a 64-hex service token.");
const requestPublicId = process.env.PROSPECTING_RESEARCH_REQUEST_PUBLIC_ID;
const mission = process.env.PROSPECTING_MISSION_PUBLIC_ID;
const prospect = process.env.PROSPECTING_PROSPECT_PUBLIC_ID;
if (!requestPublicId && (!mission || !prospect)) throw new Error("PROSPECTING_MISSION_PUBLIC_ID and PROSPECTING_PROSPECT_PUBLIC_ID are required unless PROSPECTING_RESEARCH_REQUEST_PUBLIC_ID is supplied.");
const website = process.env.PROSPECTING_WEBSITE_URL;
const researchKey = process.env.PROSPECTING_RESEARCH_IDEMPOTENCY_KEY ?? `website-research-${randomUUID()}`;

async function ingest(operation, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ request_id: `phase6-${randomUUID()}`, operation, payload }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = response.status >= 400 && response.status < 500
      ? new ConfirmedIngestError(json.error ?? `Internal ingest rejected the request with HTTP ${response.status}.`)
      : new Error(json.error ?? `Internal ingest failed with HTTP ${response.status}.`);
    throw error;
  }
  return json.result;
}

const claim = requestPublicId ? await ingest("CLAIM_WEBSITE_RESEARCH_REQUEST", { request_public_id: requestPublicId }) : null;
const completed = await runManualWebsiteResearch({
  ingest, transport: createPinnedHttpsTransport(), missionPublicId: claim?.run?.mission_id || mission, prospectPublicId: claim?.run?.prospect_id || prospect,
  requestedUrl: website, idempotencyKey: researchKey, runPublicId: claim?.run?.public_id, requestPublicId,
});
console.log(JSON.stringify({ research_public_id: completed.persisted.research.public_id, status: completed.persisted.research.status, stop_reason: completed.persisted.research.stop_reason }, null, 2));
