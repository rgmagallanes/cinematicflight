import { DEFAULT_QUALIFICATION_THRESHOLD, assertValidScore } from "./scoring.ts";
import type { BudgetDecisionCode } from "./budget-policy.ts";

export const TOOL_COST_CLASSES = ["FREE", "ESTIMATED_PAID", "KNOWN_PAID"] as const;
export type ToolCostClass = typeof TOOL_COST_CLASSES[number];

export interface PaidToolPolicyInput {
  costClass: ToolCostClass;
  isEnrichment: boolean;
  prospectScore?: number;
  qualificationThreshold?: number;
  freeContactResearchAttempted?: boolean;
  adequateContactExists?: boolean;
  authorityAllowed: boolean;
  budgetDecision: BudgetDecisionCode;
}

export interface PaidToolDecision {
  allowed: boolean;
  decision: "ALLOW" | "DENY";
  reason: string;
}

export function evaluatePaidToolPolicy(input: PaidToolPolicyInput): PaidToolDecision {
  if (!input.authorityAllowed) return deny("Authority policy denied the tool.");
  if (input.costClass === "FREE") return { allowed: true, decision: "ALLOW", reason: "The authority-approved tool is free." };
  if (input.budgetDecision !== "ALLOW") return deny("The paid tool did not pass both budget ceilings.");
  if (!input.isEnrichment) return { allowed: true, decision: "ALLOW", reason: "The authority-approved paid tool passed both budget ceilings." };

  const threshold = input.qualificationThreshold ?? DEFAULT_QUALIFICATION_THRESHOLD;
  if (input.prospectScore === undefined) return deny("Paid enrichment requires a deterministic prospect score.");
  assertValidScore(input.prospectScore, "prospect score");
  assertValidScore(threshold, "qualification threshold");
  if (input.prospectScore < threshold) return deny("The prospect does not meet the configured enrichment threshold.");
  if (input.freeContactResearchAttempted !== true) return deny("Free contact research must be attempted before paid enrichment.");
  if (input.adequateContactExists !== false) return deny("Paid enrichment requires a confirmed absence of adequate contact details.");
  return { allowed: true, decision: "ALLOW", reason: "Paid enrichment prerequisites and both budget ceilings passed." };
}

function deny(reason: string): PaidToolDecision {
  return { allowed: false, decision: "DENY", reason };
}
