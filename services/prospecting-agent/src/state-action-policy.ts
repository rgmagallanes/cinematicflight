import type { ProspectStatus } from "./vocabulary.ts";

export const STATE_ACTION_POLICY: Readonly<Record<ProspectStatus, readonly string[]>> = Object.freeze({
  DISCOVERED: ["DISCOVER_MORE", "INSPECT_WEBSITE", "SAVE_EVIDENCE", "SAVE_PROSPECT"],
  RESEARCHING: [
    "DISCOVER_MORE", "INSPECT_WEBSITE", "INSPECT_PAGE", "DETECT_EXISTING_EXPERIENCE", "FIND_CONTACT",
    "ANALYZE_EXPERIENCE_GAP", "CALCULATE_SCORE", "SAVE_EVIDENCE", "SAVE_PROSPECT", "STOP_POLICY_BLOCKED",
    "STOP_PAGE_LIMIT", "STOP_TIME_LIMIT", "STOP_TOOL_FAILURE", "STOP_RESEARCH_COMPLETE",
  ],
  INSUFFICIENT_EVIDENCE: [],
  DISQUALIFIED: [],
  QUALIFIED: ["GENERATE_WALKTHROUGH", "DRAFT_OUTREACH", "REQUEST_APPROVAL", "SAVE_EVIDENCE", "SAVE_PROSPECT"],
  PENDING_APPROVAL: [],
  APPROVED: [],
  REJECTED: [],
  PROMOTED_TO_STUDIO: [],
  FAILED: [],
});

export interface StateActionDecision {
  allowed: boolean;
  decision: "ALLOW" | "DENY";
  reason: string;
}

export function evaluateStateAction(status: ProspectStatus, action: unknown): StateActionDecision {
  if (typeof action === "string" && STATE_ACTION_POLICY[status]?.includes(action)) {
    return { allowed: true, decision: "ALLOW", reason: `${action} is valid while the prospect is ${status}.` };
  }
  return {
    allowed: false,
    decision: "DENY",
    reason: `${String(action)} is not defined for prospect state ${status}; state/action policy defaults to deny.`,
  };
}
