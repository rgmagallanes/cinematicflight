import { AGENT_ACTIONS, STOP_REASONS, type AgentAction, type StopReason } from "./vocabulary.ts";

const PUBLIC_ID_PATTERN = /^[a-z][a-z0-9-]{1,31}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isValidCentavoAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function assertValidCentavoAmount(value: unknown, field = "amount"): asserts value is number {
  if (!isValidCentavoAmount(value)) throw new TypeError(`${field} must be a non-negative safe integer in PHP centavos.`);
}

export function isValidPublicId(value: unknown, expectedPrefix?: string): value is string {
  if (typeof value !== "string" || !PUBLIC_ID_PATTERN.test(value)) return false;
  return expectedPrefix === undefined || value.startsWith(`${expectedPrefix}_`);
}

export function isAllowedAgentAction(value: unknown): value is AgentAction {
  return typeof value === "string" && (AGENT_ACTIONS as readonly string[]).includes(value);
}

export function isValidStopReason(value: unknown): value is StopReason {
  return typeof value === "string" && (STOP_REASONS as readonly string[]).includes(value);
}
