import assert from "node:assert/strict";
import test from "node:test";
import {
  createOperationFingerprint,
  evaluateExecutionLimits,
  evaluateLoopProtection,
  evaluateStoppingRules,
} from "../src/index.ts";

const counters = {
  completedStepCount: 0,
  inspectedPageCount: 0,
  completedLlmCallCount: 0,
  elapsedResearchMs: 0,
};

test("execution proceeds below limits and stops at each exact completed-work boundary", () => {
  assert.equal(evaluateExecutionLimits({ ...counters, completedStepCount: 11 }).decision, "CONTINUE");
  assert.equal(evaluateExecutionLimits({ ...counters, completedStepCount: 12 }).decision, "STOP_STEP_LIMIT");
  assert.equal(evaluateExecutionLimits({ ...counters, inspectedPageCount: 8 }).decision, "STOP_PAGE_LIMIT");
  assert.equal(evaluateExecutionLimits({ ...counters, completedLlmCallCount: 3 }).decision, "STOP_LLM_LIMIT");
  assert.equal(evaluateExecutionLimits({ ...counters, elapsedResearchMs: 90_000 }).decision, "STOP_TIME_LIMIT");
});

test("execution limits are configurable", () => {
  const result = evaluateExecutionLimits({ ...counters, completedStepCount: 2 }, { maxAgentStepsPerLead: 2 });
  assert.equal(result.decision, "STOP_STEP_LIMIT");
});

test("operation fingerprints ignore object key order but retain effective arguments", () => {
  const a = createOperationFingerprint({ action: "INSPECT_PAGE", target: "https://example.com", relevantArguments: { b: 2, a: 1 } });
  const b = createOperationFingerprint({ action: "INSPECT_PAGE", target: "https://example.com", relevantArguments: { a: 1, b: 2 } });
  assert.equal(a, b);
});

test("first operation is allowed and an identical repeat without progress is stopped", () => {
  const operation = { action: "INSPECT_PAGE", target: "https://example.com/rooms", relevantArguments: { locale: "en" }, stateVersion: 1, evidenceVersion: 1 };
  assert.equal(evaluateLoopProtection(operation, []).decision, "CONTINUE");
  assert.equal(evaluateLoopProtection(operation, [operation]).decision, "STOP_REPEATED_ACTION");
});

test("same operation is allowed after meaningful evidence progress", () => {
  const prior = { action: "INSPECT_PAGE", target: "https://example.com/rooms", stateVersion: 1, evidenceVersion: 1 };
  const next = { ...prior, evidenceVersion: 2 };
  assert.equal(evaluateLoopProtection(next, [prior]).decision, "CONTINUE");
});

test("stopping rules cover qualification, disqualification, insufficient evidence, budget, approval, and loops", () => {
  assert.equal(evaluateStoppingRules({ prospectStatus: "QUALIFIED" }).decision, "STOP_QUALIFIED");
  assert.equal(evaluateStoppingRules({ prospectStatus: "DISQUALIFIED" }).decision, "STOP_DISQUALIFIED");
  assert.equal(evaluateStoppingRules({ prospectStatus: "RESEARCHING", evidenceSufficient: false }).decision, "STOP_INSUFFICIENT_EVIDENCE");
  assert.equal(evaluateStoppingRules({ prospectStatus: "RESEARCHING", nextActionIsPaid: true, budgetDecision: "DENY_BUDGET" }).decision, "STOP_BUDGET_LIMIT");
  assert.equal(evaluateStoppingRules({ prospectStatus: "PENDING_APPROVAL", qualificationStatus: "QUALIFIED" }).decision, "STOP_HUMAN_APPROVAL_REQUIRED");
  assert.equal(evaluateStoppingRules({ prospectStatus: "RESEARCHING", repeatedAction: true }).decision, "STOP_REPEATED_ACTION");
});

test("stopping precedence favors hard failures and lifecycle gates", () => {
  assert.equal(evaluateStoppingRules({ prospectStatus: "RESEARCHING", toolFailure: true, repeatedAction: true }).decision, "STOP_TOOL_FAILURE");
  assert.equal(evaluateStoppingRules({ prospectStatus: "PENDING_APPROVAL", nextActionIsPaid: true, budgetDecision: "DENY_BUDGET" }).decision, "STOP_HUMAN_APPROVAL_REQUIRED");
});
