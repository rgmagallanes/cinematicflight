import assert from "node:assert/strict";
import test from "node:test";
import {
  MISSION_TRANSITIONS,
  PROSPECT_TRANSITIONS,
  assertMissionTransition,
  assertProspectTransition,
  canTransitionMission,
  canTransitionProspect,
} from "../src/index.ts";

test("required prospect lifecycle transitions are legal", () => {
  const legal = [
    ["DISCOVERED", "RESEARCHING"],
    ["RESEARCHING", "QUALIFIED"],
    ["RESEARCHING", "DISQUALIFIED"],
    ["QUALIFIED", "PENDING_APPROVAL"],
    ["PENDING_APPROVAL", "APPROVED"],
    ["PENDING_APPROVAL", "REJECTED"],
    ["APPROVED", "PROMOTED_TO_STUDIO"],
  ] as const;
  for (const [from, to] of legal) assert.equal(canTransitionProspect(from, to), true, `${from} -> ${to}`);
});

test("unsafe prospect lifecycle shortcuts are rejected", () => {
  const illegal = [
    ["DISCOVERED", "PROMOTED_TO_STUDIO"],
    ["REJECTED", "PROMOTED_TO_STUDIO"],
    ["DISQUALIFIED", "APPROVED"],
  ] as const;
  for (const [from, to] of illegal) {
    assert.equal(canTransitionProspect(from, to), false, `${from} -> ${to}`);
    assert.throws(() => assertProspectTransition(from, to), /Invalid prospect transition/);
  }
});

test("research retries are explicit and promoted prospects are terminal", () => {
  for (const status of ["INSUFFICIENT_EVIDENCE", "DISQUALIFIED", "FAILED", "REJECTED"] as const) {
    assert.equal(canTransitionProspect(status, "RESEARCHING"), true);
  }
  assert.deepEqual(PROSPECT_TRANSITIONS.PROMOTED_TO_STUDIO, []);
});

test("mission lifecycle supports preparation, execution, pause and terminal completion", () => {
  assert.equal(canTransitionMission("DRAFT", "READY"), true);
  assert.equal(canTransitionMission("READY", "RUNNING"), true);
  assert.equal(canTransitionMission("RUNNING", "PAUSED"), true);
  assert.equal(canTransitionMission("PAUSED", "RUNNING"), true);
  assert.equal(canTransitionMission("RUNNING", "COMPLETED"), true);
  assert.deepEqual(MISSION_TRANSITIONS.COMPLETED, []);
});

test("mission retry requires returning to READY", () => {
  assert.equal(canTransitionMission("FAILED", "READY"), true);
  assert.equal(canTransitionMission("BUDGET_EXHAUSTED", "READY"), true);
  assert.equal(canTransitionMission("FAILED", "RUNNING"), false);
  assert.throws(() => assertMissionTransition("CANCELLED", "RUNNING"), /Invalid mission transition/);
});

test("transition assertions accept legal changes", () => {
  assert.doesNotThrow(() => assertProspectTransition("DISCOVERED", "RESEARCHING"));
  assert.doesNotThrow(() => assertMissionTransition("DRAFT", "READY"));
});
