export const DEFAULT_EXECUTION_LIMITS = Object.freeze({
  maxAgentStepsPerLead: 12,
  maxPagesPerSite: 8,
  maxLlmCallsPerLead: 3,
  maxResearchSecondsPerLead: 90,
});

export interface ExecutionLimits {
  maxAgentStepsPerLead: number;
  maxPagesPerSite: number;
  maxLlmCallsPerLead: number;
  maxResearchSecondsPerLead: number;
}

export interface ExecutionCounters {
  completedStepCount: number;
  inspectedPageCount: number;
  completedLlmCallCount: number;
  elapsedResearchMs: number;
}

export type ExecutionLimitDecision = "CONTINUE" | "STOP_STEP_LIMIT" | "STOP_PAGE_LIMIT" | "STOP_LLM_LIMIT" | "STOP_TIME_LIMIT";

export interface ExecutionLimitResult {
  allowed: boolean;
  decision: ExecutionLimitDecision;
  reason: string;
}

export function evaluateExecutionLimits(
  counters: ExecutionCounters,
  overrides: Partial<ExecutionLimits> = {},
): ExecutionLimitResult {
  const limits = { ...DEFAULT_EXECUTION_LIMITS, ...overrides };
  validateCounters(counters);
  validateLimits(limits);

  // Counters are completed work. Reaching a maximum means no next action is eligible.
  if (counters.completedStepCount >= limits.maxAgentStepsPerLead) return stop("STOP_STEP_LIMIT", "The completed step count reached its limit.");
  if (counters.inspectedPageCount >= limits.maxPagesPerSite) return stop("STOP_PAGE_LIMIT", "The inspected page count reached its limit.");
  if (counters.completedLlmCallCount >= limits.maxLlmCallsPerLead) return stop("STOP_LLM_LIMIT", "The completed LLM call count reached its limit.");
  if (counters.elapsedResearchMs >= limits.maxResearchSecondsPerLead * 1000) return stop("STOP_TIME_LIMIT", "The elapsed research time reached its limit.");
  return { allowed: true, decision: "CONTINUE", reason: "All execution counters remain below their configured maxima." };
}

function stop(decision: Exclude<ExecutionLimitDecision, "CONTINUE">, reason: string): ExecutionLimitResult {
  return { allowed: false, decision, reason };
}

function validateCounters(counters: ExecutionCounters): void {
  for (const [field, value] of Object.entries(counters)) {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${field} must be a non-negative safe integer.`);
  }
}

function validateLimits(limits: ExecutionLimits): void {
  for (const [field, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${field} must be a positive safe integer.`);
  }
}
