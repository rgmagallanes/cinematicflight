import type { JsonValue } from "./model.ts";

export interface OperationIdentity {
  action: string;
  target?: string | null;
  relevantArguments?: Record<string, JsonValue>;
}

export interface OperationAttempt extends OperationIdentity {
  stateVersion: string | number;
  evidenceVersion: string | number;
}

export interface LoopProtectionResult {
  allowed: boolean;
  decision: "CONTINUE" | "STOP_REPEATED_ACTION";
  reason: string;
  fingerprint: string;
  matchingAttemptsWithoutProgress: number;
}

export function createOperationFingerprint(operation: OperationIdentity): string {
  if (typeof operation.action !== "string" || operation.action.trim() === "") throw new TypeError("Operation action must be non-empty.");
  return canonicalJson({
    action: operation.action,
    target: normalizeTarget(operation.target),
    relevantArguments: operation.relevantArguments ?? {},
  });
}

export function evaluateLoopProtection(
  next: OperationAttempt,
  history: readonly OperationAttempt[],
  repeatThreshold = 2,
): LoopProtectionResult {
  if (!Number.isSafeInteger(repeatThreshold) || repeatThreshold < 2) {
    throw new RangeError("repeatThreshold must be an integer of at least 2.");
  }
  const fingerprint = createOperationFingerprint(next);
  const matchingAttempts = history.filter((attempt) =>
    createOperationFingerprint(attempt) === fingerprint
    && attempt.stateVersion === next.stateVersion
    && attempt.evidenceVersion === next.evidenceVersion
  ).length;
  if (matchingAttempts + 1 >= repeatThreshold) {
    return {
      allowed: false,
      decision: "STOP_REPEATED_ACTION",
      reason: "The same effective operation would repeat without new state or evidence.",
      fingerprint,
      matchingAttemptsWithoutProgress: matchingAttempts,
    };
  }
  return {
    allowed: true,
    decision: "CONTINUE",
    reason: "The operation has not reached the no-progress repeat threshold.",
    fingerprint,
    matchingAttemptsWithoutProgress: matchingAttempts,
  };
}

function normalizeTarget(target: string | null | undefined): string | null {
  if (target === undefined || target === null) return null;
  return target.trim();
}

function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
