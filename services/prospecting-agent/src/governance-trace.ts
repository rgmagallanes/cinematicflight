export interface GovernanceCheckTrace {
  result: "ALLOW" | "ALLOW_FREE" | "DENY" | "DENY_BUDGET" | "CONTINUE" | "NOT_EVALUATED" | string;
  reason?: string;
}

export interface GovernanceTrace {
  action: string;
  validation: GovernanceCheckTrace;
  authority: GovernanceCheckTrace;
  state: GovernanceCheckTrace;
  limits: GovernanceCheckTrace;
  budget: GovernanceCheckTrace;
  final: GovernanceCheckTrace;
}
