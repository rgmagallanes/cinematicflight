export const WEBSITE_CONTENT_TRUST = "UNTRUSTED_EXTERNAL_CONTENT" as const;

export const WEBSITE_CONTENT_ALLOWED_USES = ["EVIDENCE", "FACTUAL_INPUT", "ANALYSIS_TEXT", "SOURCE_MATERIAL"] as const;
export const WEBSITE_CONTENT_FORBIDDEN_USES = [
  "SYSTEM_INSTRUCTIONS",
  "AUTHORITY_INSTRUCTIONS",
  "TOOL_PERMISSION",
  "BUDGET_PERMISSION",
  "LIFECYCLE_PERMISSION",
  "CODE_EXECUTION_INSTRUCTIONS",
] as const;

export interface ClassifiedWebsiteContent {
  trust: typeof WEBSITE_CONTENT_TRUST;
  content: string;
  mayGrantAuthority: false;
  mayAuthorizeCodeExecution: false;
}

export function classifyWebsiteContent(content: string): ClassifiedWebsiteContent {
  return {
    trust: WEBSITE_CONTENT_TRUST,
    content,
    mayGrantAuthority: false,
    mayAuthorizeCodeExecution: false,
  };
}

export function isPermittedWebsiteContentUse(use: unknown): boolean {
  return typeof use === "string" && (WEBSITE_CONTENT_ALLOWED_USES as readonly string[]).includes(use);
}
