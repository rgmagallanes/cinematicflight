import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_QUALIFICATION_THRESHOLD,
  calculateScore,
  clampScore,
  classifyPriority,
  evaluateQualification,
  meetsQualificationThreshold,
} from "../src/index.ts";

const perfect = {
  experienceGap: 100,
  walkthroughFit: 100,
  commercialFit: 100,
  visualProperty: 100,
  contactability: 100,
};

test("perfect prospect scores 100 and HOT", () => {
  assert.deepEqual(calculateScore(perfect), {
    scoringRuleVersion: "cinematicflight-v1",
    weightedScore: 100,
    penaltyScore: 0,
    finalScore: 100,
    priority: "HOT",
    duplicate: false,
  });
});

test("strong prospect with an existing-experience penalty loses 20 points", () => {
  const result = calculateScore(perfect, { existingStrongInteractiveWalkthrough: true });
  assert.equal(result.penaltyScore, -20);
  assert.equal(result.finalScore, 80);
  assert.equal(result.priority, "HIGH");
});

test("no official website applies the ten-point penalty", () => {
  const result = calculateScore(perfect, { noOfficialWebsite: true });
  assert.equal(result.penaltyScore, -10);
  assert.equal(result.finalScore, 90);
});

test("weak physical-space relevance applies the thirty-point penalty", () => {
  const result = calculateScore(perfect, { weakPhysicalSpaceRelevance: true });
  assert.equal(result.penaltyScore, -30);
  assert.equal(result.finalScore, 70);
});

test("combined penalties clamp a low score at zero", () => {
  const result = calculateScore({ ...perfect, experienceGap: 0, walkthroughFit: 0, commercialFit: 0, visualProperty: 0, contactability: 0 }, {
    existingStrongInteractiveWalkthrough: true,
    weakPhysicalSpaceRelevance: true,
    noOfficialWebsite: true,
  });
  assert.equal(result.penaltyScore, -60);
  assert.equal(result.finalScore, 0);
});

test("score clamp bounds values above 100", () => assert.equal(clampScore(140), 100));
test("score clamp bounds values below zero", () => assert.equal(clampScore(-40), 0));

test("priority boundaries are deterministic", () => {
  assert.equal(classifyPriority(100), "HOT");
  assert.equal(classifyPriority(90), "HOT");
  assert.equal(classifyPriority(89), "HIGH");
  assert.equal(classifyPriority(75), "HIGH");
  assert.equal(classifyPriority(74), "MEDIUM");
  assert.equal(classifyPriority(60), "MEDIUM");
  assert.equal(classifyPriority(59), "LOW");
  assert.equal(classifyPriority(0), "LOW");
});

test("default qualification threshold is 75", () => {
  assert.equal(DEFAULT_QUALIFICATION_THRESHOLD, 75);
  assert.equal(meetsQualificationThreshold(75), true);
  assert.equal(meetsQualificationThreshold(74), false);
});

test("duplicate and insufficient evidence deterministically block qualification", () => {
  assert.equal(meetsQualificationThreshold(95, 75, { duplicate: true }), false);
  assert.equal(meetsQualificationThreshold(95, 75, { evidenceSufficient: false }), false);
  assert.equal(evaluateQualification(calculateScore(perfect, { duplicate: true })), false);
  assert.equal(evaluateQualification(calculateScore(perfect), 75, false), false);
});

test("weighted calculation uses the published component weights and one final rounding step", () => {
  const result = calculateScore({ experienceGap: 91, walkthroughFit: 82, commercialFit: 73, visualProperty: 64, contactability: 55 });
  assert.equal(result.finalScore, 78);
});

test("invalid component values are rejected", () => {
  assert.throws(() => calculateScore({ ...perfect, experienceGap: 101 }), /0 to 100/);
  assert.throws(() => calculateScore({ ...perfect, contactability: 74.5 }), /integer/);
});
