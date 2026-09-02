import {
  DEFAULT_QUALIFICATION_THRESHOLD,
  calculateScore,
  evaluateQualification,
  type PenaltyFlags,
  type ScoreResult,
} from "./scoring.ts";

export interface ExternalComponentAssessment {
  experience_gap_score: number;
  walkthrough_fit_score: number;
  commercial_fit_score: number;
  visual_property_score: number;
  contactability_score: number;
  [key: string]: unknown;
}

export interface GovernedScoreResult extends ScoreResult {
  qualified: boolean;
  qualificationThreshold: number;
  ignoredExternalFields: readonly string[];
}

export function calculateGovernedScore(
  assessment: ExternalComponentAssessment,
  penalties: PenaltyFlags = {},
  qualificationThreshold = DEFAULT_QUALIFICATION_THRESHOLD,
  evidenceSufficient = true,
): GovernedScoreResult {
  if (assessment === null || typeof assessment !== "object") throw new TypeError("Component assessment must be an object.");
  const score = calculateScore({
    experienceGap: assessment.experience_gap_score,
    walkthroughFit: assessment.walkthrough_fit_score,
    commercialFit: assessment.commercial_fit_score,
    visualProperty: assessment.visual_property_score,
    contactability: assessment.contactability_score,
  }, penalties);
  return {
    ...score,
    qualified: evaluateQualification(score, qualificationThreshold, evidenceSufficient),
    qualificationThreshold,
    ignoredExternalFields: Object.hasOwn(assessment, "final_score") ? ["final_score"] : [],
  };
}
