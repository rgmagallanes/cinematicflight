import type { BudgetDecisionCode } from "./budget-policy.ts";
import type { ExecutionLimitDecision } from "./execution-limits.ts";
import type { ProspectStatus } from "./vocabulary.ts";

export type StoppingDecision =
  | "CONTINUE"
  | "STOP_QUALIFIED"
  | "STOP_DISQUALIFIED"
  | "STOP_INSUFFICIENT_EVIDENCE"
  | "STOP_BUDGET_LIMIT"
  | "STOP_STEP_LIMIT"
  | "STOP_PAGE_LIMIT"
  | "STOP_LLM_LIMIT"
  | "STOP_TIME_LIMIT"
  | "STOP_DUPLICATE"
  | "STOP_HUMAN_APPROVAL_REQUIRED"
  | "STOP_REPEATED_ACTION"
  | "STOP_TOOL_FAILURE"
  | "STOP_FAILED";

export interface StoppingRuleInput {
  prospectStatus: ProspectStatus;
  qualificationStatus?: "QUALIFIED" | "DISQUALIFIED" | "INSUFFICIENT_EVIDENCE" | null;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | null;
  nextActionIsPaid?: boolean;
  budgetDecision?: BudgetDecisionCode;
  limitDecision?: ExecutionLimitDecision;
  duplicate?: boolean;
  toolFailure?: boolean;
  failed?: boolean;
  evidenceSufficient?: boolean;
  repeatedAction?: boolean;
}

export interface StoppingRuleResult {
  shouldStop: boolean;
  decision: StoppingDecision;
  reason: string;
}

export function evaluateStoppingRules(input: StoppingRuleInput): StoppingRuleResult {
  // Precedence is deliberate: failures, terminal lifecycle, duplicates, completed
  // qualification outcomes, approval gates, resource guards, then evidence status.
  if (input.toolFailure === true) return stop("STOP_TOOL_FAILURE", "A required tool failed.");
  if (input.failed === true || input.prospectStatus === "FAILED") return stop("STOP_FAILED", "The prospect or agent run is failed.");
  if (input.prospectStatus === "REJECTED" || input.prospectStatus === "PROMOTED_TO_STUDIO") {
    return stop("STOP_FAILED", `Autonomous work is unavailable in terminal prospect state ${input.prospectStatus}.`);
  }
  if (input.duplicate === true) return stop("STOP_DUPLICATE", "The prospect is a duplicate.");
  if (input.prospectStatus === "DISQUALIFIED" || input.qualificationStatus === "DISQUALIFIED") return stop("STOP_DISQUALIFIED", "The prospect is disqualified.");
  if (input.prospectStatus === "PENDING_APPROVAL" || input.approvalStatus === "PENDING") {
    return stop("STOP_HUMAN_APPROVAL_REQUIRED", "The prospect is waiting for human approval.");
  }
  if (input.prospectStatus === "QUALIFIED" || input.qualificationStatus === "QUALIFIED") return stop("STOP_QUALIFIED", "The deterministic qualification outcome is qualified.");
  if (input.nextActionIsPaid === true && input.budgetDecision === "DENY_BUDGET") {
    return stop("STOP_BUDGET_LIMIT", "The next required paid action did not pass budget policy.");
  }
  if (input.limitDecision && input.limitDecision !== "CONTINUE") {
    return stop(input.limitDecision, "An execution counter reached its configured maximum.");
  }
  if (input.repeatedAction === true) return stop("STOP_REPEATED_ACTION", "Loop protection detected a repeated operation without progress.");
  if (input.prospectStatus === "INSUFFICIENT_EVIDENCE" || input.qualificationStatus === "INSUFFICIENT_EVIDENCE" || input.evidenceSufficient === false) {
    return stop("STOP_INSUFFICIENT_EVIDENCE", "The available evidence is insufficient for qualification.");
  }
  return { shouldStop: false, decision: "CONTINUE", reason: "No deterministic stopping rule applies." };
}

function stop(decision: Exclude<StoppingDecision, "CONTINUE">, reason: string): StoppingRuleResult {
  return { shouldStop: true, decision, reason };
}
