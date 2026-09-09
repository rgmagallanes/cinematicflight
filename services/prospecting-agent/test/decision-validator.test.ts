import assert from "node:assert/strict";
import test from "node:test";
import { validateAgentDecision } from "../src/index.ts";

const context = {
  prospectStatus: "RESEARCHING" as const,
  counters: {
    completedStepCount: 2,
    inspectedPageCount: 1,
    completedLlmCallCount: 0,
    elapsedResearchMs: 10_000,
  },
  budget: {
    mission_budget_centavos: 10_000,
    mission_spent_centavos: 2_000,
    mission_reserved_centavos: 1_000,
    monthly_budget_centavos: 200_000,
    monthly_spent_centavos: 20_000,
    monthly_reserved_centavos: 1_000,
  },
};

const proposal = {
  action: "INSPECT_PAGE",
  reason: "Need evidence about amenities.",
  target: "https://example.com/amenities",
  expected_information: "Property amenities",
  estimated_cost_centavos: 0,
  confidence: 0.83,
};

test("decision validator returns a complete allow trace without executing", () => {
  const result = validateAgentDecision(proposal, context);
  assert.equal(result.allowed, true);
  assert.equal(result.trace.authority.result, "ALLOW");
  assert.equal(result.trace.state.result, "ALLOW");
  assert.equal(result.trace.limits.result, "CONTINUE");
  assert.equal(result.trace.budget.result, "ALLOW_FREE");
  assert.equal(result.trace.final.result, "ALLOW");
});

test("authority-denied outreach produces a structured deny trace", () => {
  const result = validateAgentDecision({ ...proposal, action: "SEND_EMAIL", target: null }, context);
  assert.equal(result.allowed, false);
  assert.equal(result.trace.authority.result, "DENY");
  assert.match(result.reason, /unavailable/);
});

test("state, limits, and budget independently deny otherwise valid actions", () => {
  assert.equal(validateAgentDecision(proposal, { ...context, prospectStatus: "DISCOVERED" }).trace.state.result, "DENY");
  assert.equal(validateAgentDecision(proposal, {
    ...context,
    counters: { ...context.counters, completedStepCount: 12 },
  }).trace.limits.result, "STOP_STEP_LIMIT");
  const paid = validateAgentDecision({ ...proposal, estimated_cost_centavos: 8_000 }, context);
  assert.equal(paid.trace.budget.result, "DENY_BUDGET");
  assert.equal(paid.allowed, false);
});

test("decision shape validates required fields, confidence, currency, and URL targets", () => {
  const result = validateAgentDecision({
    action: "INSPECT_PAGE",
    reason: "",
    target: "javascript:alert(1)",
    expected_information: "",
    estimated_cost_centavos: 1.5,
    confidence: 1.2,
  }, context);
  assert.equal(result.allowed, false);
  assert.ok(result.errors.length >= 5);
});

test("discovery passes only with mission, discovery-limit, and budget authorization", () => {
  const discovery = { ...proposal, action: "DISCOVER_MORE", target: null, estimated_cost_centavos: 100 };
  assert.equal(validateAgentDecision(discovery, { ...context, prospectStatus: "DISCOVERED" }).allowed, false);
  assert.equal(validateAgentDecision(discovery, {
    ...context,
    prospectStatus: "DISCOVERED",
    authority: { missionPermitsDiscovery: true, discoveryLimitReached: false },
  }).allowed, true);
});
