import { evaluateAuthority, type AuthorityContext } from "./authority-policy.ts";
import { evaluateBudget, type BudgetPolicyInput } from "./budget-policy.ts";
import { evaluateExecutionLimits, type ExecutionCounters, type ExecutionLimits } from "./execution-limits.ts";
import type { GovernanceTrace } from "./governance-trace.ts";
import { evaluateStateAction } from "./state-action-policy.ts";
import { isValidCentavoAmount } from "./validation.ts";
import type { ProspectStatus } from "./vocabulary.ts";

export interface ProposedAgentDecision {
  action: string;
  reason: string;
  target: string | null;
  expected_information: string;
  estimated_cost_centavos: number;
  confidence: number;
}

export interface DecisionGovernanceContext {
  prospectStatus: ProspectStatus;
  authority?: AuthorityContext;
  counters: ExecutionCounters;
  limits?: Partial<ExecutionLimits>;
  budget: Omit<BudgetPolicyInput, "estimated_operation_cost_centavos">;
}

export interface DecisionGovernanceResult {
  allowed: boolean;
  decision: "ALLOW" | "DENY";
  reason: string;
  errors: readonly string[];
  trace: GovernanceTrace;
}

export function validateAgentDecision(proposal: unknown, context: DecisionGovernanceContext): DecisionGovernanceResult {
  const candidate = isRecord(proposal) ? proposal : {};
  const action = typeof candidate.action === "string" ? candidate.action : "<missing>";
  const errors = validateShape(candidate);
  const estimate = isValidCentavoAmount(candidate.estimated_cost_centavos) ? candidate.estimated_cost_centavos : 0;
  const budget = evaluateBudget({ ...context.budget, estimated_operation_cost_centavos: estimate });
  const authority = evaluateAuthority(action, {
    ...context.authority,
    discoveryBudgetAllowed: context.authority?.discoveryBudgetAllowed ?? budget.allowed,
  });
  const state = evaluateStateAction(context.prospectStatus, action);
  const limits = evaluateExecutionLimits(context.counters, context.limits);

  const allowed = errors.length === 0 && authority.allowed && state.allowed && limits.allowed && budget.allowed;
  const reason = allowed
    ? "Validation, authority, lifecycle, execution-limit, and budget policies all allow the proposed action."
    : firstDenialReason(errors, authority.reason, authority.allowed, state.reason, state.allowed, limits.reason, limits.allowed, budget.reason, budget.allowed);

  return {
    allowed,
    decision: allowed ? "ALLOW" : "DENY",
    reason,
    errors,
    trace: {
      action,
      validation: { result: errors.length === 0 ? "ALLOW" : "DENY", reason: errors.join(" ") || "Required decision fields are valid." },
      authority: { result: authority.decision, reason: authority.reason },
      state: { result: state.decision, reason: state.reason },
      limits: { result: limits.decision, reason: limits.reason },
      budget: { result: budget.decision, reason: budget.reason },
      final: { result: allowed ? "ALLOW" : "DENY", reason },
    },
  };
}

function validateShape(candidate: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (typeof candidate.action !== "string" || candidate.action.trim() === "") errors.push("action must be a non-empty string.");
  if (typeof candidate.reason !== "string" || candidate.reason.trim() === "") errors.push("reason must be a non-empty string.");
  if (!Object.hasOwn(candidate, "target")) errors.push("target is required and may be null where the action permits it.");
  else if (candidate.target !== null && typeof candidate.target !== "string") errors.push("target must be a string or null.");
  if (typeof candidate.expected_information !== "string" || candidate.expected_information.trim() === "") {
    errors.push("expected_information must be a non-empty string.");
  }
  if (!isValidCentavoAmount(candidate.estimated_cost_centavos)) {
    errors.push("estimated_cost_centavos must be a non-negative safe integer.");
  }
  if (typeof candidate.confidence !== "number" || !Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) {
    errors.push("confidence must be a finite number from 0 to 1.");
  }
  if (typeof candidate.action === "string" && ["INSPECT_WEBSITE", "INSPECT_PAGE"].includes(candidate.action)) {
    if (typeof candidate.target !== "string" || !isHttpUrl(candidate.target)) {
      errors.push(`${candidate.action} requires an absolute HTTP or HTTPS target URL.`);
    }
  }
  return errors;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstDenialReason(
  errors: readonly string[],
  authorityReason: string,
  authorityAllowed: boolean,
  stateReason: string,
  stateAllowed: boolean,
  limitsReason: string,
  limitsAllowed: boolean,
  budgetReason: string,
  budgetAllowed: boolean,
): string {
  if (errors.length > 0) return errors[0];
  if (!authorityAllowed) return authorityReason;
  if (!stateAllowed) return stateReason;
  if (!limitsAllowed) return limitsReason;
  if (!budgetAllowed) return budgetReason;
  return "Governance denied the proposed action by default.";
}
