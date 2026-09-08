export const AUTONOMOUS_ACTIONS = [
  "INSPECT_WEBSITE",
  "INSPECT_PAGE",
  "DETECT_EXISTING_EXPERIENCE",
  "FIND_CONTACT",
  "ANALYZE_EXPERIENCE_GAP",
  "CALCULATE_SCORE",
  "GENERATE_WALKTHROUGH",
  "DRAFT_OUTREACH",
  "SAVE_EVIDENCE",
  "SAVE_PROSPECT",
  "STOP_POLICY_BLOCKED",
  "STOP_PAGE_LIMIT",
  "STOP_TIME_LIMIT",
  "STOP_TOOL_FAILURE",
  "STOP_RESEARCH_COMPLETE",
] as const;

export const FORBIDDEN_V1_ACTIONS = [
  "SEND_EMAIL",
  "SEND_DM",
  "SUBMIT_CONTACT_FORM",
  "PURCHASE_SERVICE",
  "PROMOTE_TO_STUDIO",
  "DELETE_PROSPECT",
  "MODIFY_STUDIO_INQUIRY",
  "EXECUTE_ARBITRARY_HTTP",
  "EXECUTE_SHELL",
  "EXECUTE_CODE_FROM_WEBSITE",
] as const;

export interface AuthorityContext {
  missionPermitsDiscovery?: boolean;
  discoveryLimitReached?: boolean;
  discoveryBudgetAllowed?: boolean;
}

export interface AuthorityDecision {
  allowed: boolean;
  decision: "ALLOW" | "DENY";
  reason: string;
  requiresHumanApproval: boolean;
}

export function evaluateAuthority(action: unknown, context: AuthorityContext = {}): AuthorityDecision {
  if (typeof action !== "string") {
    return deny("An action name is required. Unknown actions are denied by default.");
  }

  if ((AUTONOMOUS_ACTIONS as readonly string[]).includes(action)) {
    return {
      allowed: true,
      decision: "ALLOW",
      reason: `${action} is permitted for autonomous Version 1 governance.`,
      requiresHumanApproval: false,
    };
  }

  if (action === "DISCOVER_MORE") {
    if (context.missionPermitsDiscovery !== true) return deny("The mission does not permit discovery.");
    if (context.discoveryLimitReached !== false) return deny("The discovery limit has been reached or was not established.");
    if (context.discoveryBudgetAllowed !== true) return deny("The discovery provider has not passed budget authorization.");
    return {
      allowed: true,
      decision: "ALLOW",
      reason: "Mission, discovery-limit, and provider-budget policies allow more discovery.",
      requiresHumanApproval: false,
    };
  }

  if (action === "REQUEST_APPROVAL") {
    return {
      allowed: true,
      decision: "ALLOW",
      reason: "The agent may request, but cannot resolve, human approval.",
      requiresHumanApproval: true,
    };
  }

  if ((FORBIDDEN_V1_ACTIONS as readonly string[]).includes(action)) {
    const human = ["SEND_EMAIL", "SEND_DM", "SUBMIT_CONTACT_FORM", "PURCHASE_SERVICE", "PROMOTE_TO_STUDIO"].includes(action);
    return deny(`${action} execution is unavailable to the Version 1 agent.`, human);
  }

  return deny(`Unknown or unlisted action ${JSON.stringify(action)} is denied by default.`);
}

function deny(reason: string, requiresHumanApproval = false): AuthorityDecision {
  return { allowed: false, decision: "DENY", reason, requiresHumanApproval };
}
