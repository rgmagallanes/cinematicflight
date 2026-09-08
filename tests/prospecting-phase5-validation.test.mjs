import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateScore,
  DEFAULT_QUALIFICATION_THRESHOLD,
  meetsQualificationThreshold,
} from '../services/prospecting-agent/src/scoring.ts';

// Helper: qualify a prospect using the REAL deterministic scoring
export function qualifyProspect(components, penalties = {}) {
  const result = calculateScore(components, penalties);
  return {
    ...result,
    experienceGapComponent: components.experienceGap,
    walkthroughFitComponent: components.walkthroughFit,
    commercialFitComponent: components.commercialFit,
    visualPropertyFitComponent: components.visualProperty,
    contactabilityComponent: components.contactability,
    qualified: meetsQualificationThreshold(result.finalScore, DEFAULT_QUALIFICATION_THRESHOLD),
  };
}

// Phase 5B - Manual Workflow Execution Validation
// Test representative prospect scenarios through the real scoring implementation

test('Phase 5B - Scenario A: Excellent Fit', async () => {
  // Qualify prospect using real scoring implementation
  const qualification = await qualifyProspect({
    experienceGap: 90,
    walkthroughFit: 90,
    commercialFit: 95,
    visualProperty: 92,
    contactability: 95,
  }, {});

  // Verify production scoring results
  // Real production result: 5 high components (90/90/95/92/95)
  // weightedScore = (90*30 + 90*25 + 95*20 + 92*15 + 95*10) / 100 = 92.5 → clamped 92
  // penaltyScore = 0 (no penalties)
  // finalScore = 92 (no penalties)
  // priority = HOT (92 >= 90)
  // qualified = true (92 >= 75)
  assert.equal(qualification.weightedScore, 92);
  assert.equal(qualification.penaltyScore, 0);
  assert.equal(qualification.finalScore, 92);
  assert.equal(qualification.priority, 'HOT');
  assert.equal(qualification.qualified, true);
});

test('Phase 5B - Scenario B: Good Fit', async () => {
  // Qualify prospect using real scoring implementation
  const qualification = await qualifyProspect({
    experienceGap: 80,
    walkthroughFit: 80,
    commercialFit: 85,
    visualProperty: 82,
    contactability: 85,
  }, {});

  // Verify production scoring results
  // Real production result: 5 good components (80/80/85/82/85)
  // weightedScore = (80*30 + 80*25 + 85*20 + 82*15 + 85*10) / 100 = 82.5 → clamped 82
  // penaltyScore = 0 (no penalties)
  // finalScore = 82 (no penalties)
  // priority = HIGH (82 >= 75 and < 90)
  // qualified = true (82 >= 75)
  assert.equal(qualification.weightedScore, 82);
  assert.equal(qualification.penaltyScore, 0);
  assert.equal(qualification.finalScore, 82);
  assert.equal(qualification.priority, 'HIGH');
  assert.equal(qualification.qualified, true);
});

test('Phase 5B - Scenario C: Existing Interactive Experience', async () => {
  // Qualify prospect with existingStrongInteractiveWalkthrough penalty
  const qualification = await qualifyProspect(
    {
      experienceGap: 85,
      walkthroughFit: 85,
      commercialFit: 80,
      visualProperty: 90,
      contactability: 90,
    },
    { existingStrongInteractiveWalkthrough: true }
  );

  // REAL PRODUCTION SCORING:
  // weightedScore = 85 (raw weighted average, 5 components at high values)
  // penaltyScore = -20 (deterministic penalty for existing strong interactive walkthrough)
  // finalScore = 65 (85 + (-20), below qualification threshold)
  // priority = MEDIUM (65 >= 60 and < 75)
  // qualified = false (65 < 75)

  // Verify component scores are preserved
  assert.equal(qualification.experienceGapComponent, 85);
  assert.equal(qualification.walkthroughFitComponent, 85);
  assert.equal(qualification.commercialFitComponent, 80);
  assert.equal(qualification.visualPropertyFitComponent, 90);
  assert.equal(qualification.contactabilityComponent, 90);

  // CRITICAL: Verify the deterministic penalty effect
  // The weighted score is strong (85 >= 75), but the -20 penalty pushes finalScore below threshold
  assert.equal(qualification.weightedScore, 85);
  assert.equal(qualification.penaltyScore, -20);
  assert.equal(qualification.finalScore, 65);
  assert.equal(qualification.priority, 'MEDIUM');
  assert.equal(qualification.qualified, false);

  // The point of this scenario: strong weighted score + deterministic penalty
  // final score below qualification threshold
  // Qualification is based on finalScore >= 75, NOT weightedScore >= 75
});

test('Phase 5B - Scenario D: Poor Contactability', async () => {
  // Qualify prospect with poor contactability
  const qualification = await qualifyProspect({
    experienceGap: 90,
    walkthroughFit: 90,
    commercialFit: 90,
    visualProperty: 90,
    contactability: 30,
  }, {});

  // Verify contactability lowers the score
  // Real production result: 5 strong components (90/90/90/90/30)
  // weightedScore = (90*30 + 90*25 + 90*20 + 90*15 + 30*10) / 100 = 84.0 → clamped 84
  // penaltyScore = 0 (no penalties)
  // finalScore = 84 (no penalties)
  // priority = HIGH (84 >= 75)
  // qualified = true (84 >= 75)
  assert.equal(qualification.weightedScore, 84);
  assert.equal(qualification.penaltyScore, 0);
  assert.equal(qualification.finalScore, 84);
  assert.equal(qualification.priority, 'HIGH');
  assert.equal(qualification.qualified, true);
});

test('Phase 5B - Scenario E: Weak Fit', async () => {
  // Qualify prospect with weak fit
  const qualification = await qualifyProspect({
    experienceGap: 30,
    walkthroughFit: 30,
    commercialFit: 40,
    visualProperty: 35,
    contactability: 80,
  }, {});

  // Verify weak fit results - falls well below qualification threshold
  // Real production result: 5 weak components (30/30/40/35/80)
  // weightedScore = (30*30 + 30*25 + 40*20 + 35*15 + 80*10) / 100 = 38.0 → clamped 38
  // penaltyScore = 0 (no penalties)
  // finalScore = 38 (no penalties)
  // priority = LOW (38 < 60)
  // qualified = false (38 < 75)
  assert.equal(qualification.weightedScore, 38);
  assert.equal(qualification.penaltyScore, 0);
  assert.equal(qualification.finalScore, 38);
  assert.equal(qualification.priority, 'LOW');
  assert.equal(qualification.qualified, false);
});
