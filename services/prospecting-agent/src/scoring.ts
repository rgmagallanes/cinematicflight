import type { Priority } from "./vocabulary.ts";

export const SCORING_RULE_VERSION = "cinematicflight-v1" as const;
export const DEFAULT_QUALIFICATION_THRESHOLD = 75;

export const SCORE_WEIGHTS = Object.freeze({
  experienceGap: 30,
  walkthroughFit: 25,
  commercialFit: 20,
  visualProperty: 15,
  contactability: 10,
});

export const SCORE_PENALTIES = Object.freeze({
  existingStrongInteractiveWalkthrough: -20,
  weakPhysicalSpaceRelevance: -30,
  noOfficialWebsite: -10,
});

export interface ScoreComponents {
  experienceGap: number;
  walkthroughFit: number;
  commercialFit: number;
  visualProperty: number;
  contactability: number;
}

export interface PenaltyFlags {
  existingStrongInteractiveWalkthrough?: boolean;
  weakPhysicalSpaceRelevance?: boolean;
  noOfficialWebsite?: boolean;
  duplicate?: boolean;
}

export interface ScoreResult {
  scoringRuleVersion: typeof SCORING_RULE_VERSION;
  weightedScore: number;
  penaltyScore: number;
  finalScore: number;
  priority: Priority;
  duplicate: boolean;
}

export function assertValidScore(value: number, field = "score"): void {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new RangeError(`${field} must be an integer from 0 to 100.`);
  }
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) throw new TypeError("Score must be a finite number.");
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function classifyPriority(score: number): Priority {
  assertValidScore(score, "final score");
  if (score >= 90) return "HOT";
  if (score >= 75) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

export function calculatePenaltyScore(flags: PenaltyFlags = {}): number {
  return (flags.existingStrongInteractiveWalkthrough ? SCORE_PENALTIES.existingStrongInteractiveWalkthrough : 0)
    + (flags.weakPhysicalSpaceRelevance ? SCORE_PENALTIES.weakPhysicalSpaceRelevance : 0)
    + (flags.noOfficialWebsite ? SCORE_PENALTIES.noOfficialWebsite : 0);
}

export function calculateScore(components: ScoreComponents, penalties: PenaltyFlags = {}): ScoreResult {
  for (const [field, value] of Object.entries(components)) assertValidScore(value, field);

  const weightedRaw = (
    components.experienceGap * SCORE_WEIGHTS.experienceGap
    + components.walkthroughFit * SCORE_WEIGHTS.walkthroughFit
    + components.commercialFit * SCORE_WEIGHTS.commercialFit
    + components.visualProperty * SCORE_WEIGHTS.visualProperty
    + components.contactability * SCORE_WEIGHTS.contactability
  ) / 100;
  const weightedScore = clampScore(weightedRaw);
  const penaltyScore = calculatePenaltyScore(penalties);
  const finalScore = clampScore(weightedRaw + penaltyScore);

  return {
    scoringRuleVersion: SCORING_RULE_VERSION,
    weightedScore,
    penaltyScore,
    finalScore,
    priority: classifyPriority(finalScore),
    duplicate: penalties.duplicate === true,
  };
}

export function meetsQualificationThreshold(
  finalScore: number,
  threshold = DEFAULT_QUALIFICATION_THRESHOLD,
  options: { duplicate?: boolean; evidenceSufficient?: boolean } = {},
): boolean {
  assertValidScore(finalScore, "final score");
  assertValidScore(threshold, "qualification threshold");
  if (options.duplicate === true || options.evidenceSufficient === false) return false;
  return finalScore >= threshold;
}

export function evaluateQualification(
  score: Pick<ScoreResult, "finalScore" | "duplicate">,
  threshold = DEFAULT_QUALIFICATION_THRESHOLD,
  evidenceSufficient = true,
): boolean {
  return meetsQualificationThreshold(score.finalScore, threshold, {
    duplicate: score.duplicate,
    evidenceSufficient,
  });
}
