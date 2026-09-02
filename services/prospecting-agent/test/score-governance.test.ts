import assert from "node:assert/strict";
import test from "node:test";
import { calculateGovernedScore } from "../src/index.ts";

test("an externally supplied final score cannot override deterministic scoring", () => {
  const result = calculateGovernedScore({
    experience_gap_score: 50,
    walkthrough_fit_score: 50,
    commercial_fit_score: 50,
    visual_property_score: 50,
    contactability_score: 50,
    final_score: 99,
  });
  assert.equal(result.finalScore, 50);
  assert.equal(result.qualified, false);
  assert.deepEqual(result.ignoredExternalFields, ["final_score"]);
});
