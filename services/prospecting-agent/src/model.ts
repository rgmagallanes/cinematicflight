import type {
  AgentAction, ContactStatus, ContactType, ContactVerificationStatus, MissionStatus, Priority, ProspectStatus, StopReason,
} from "./vocabulary.ts";

export type DatabaseId = number;
export type PublicId = string;
export type IsoDateTime = string;
export type Centavos = number;
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface Mission {
  id: DatabaseId;
  public_id: PublicId;
  owner_id: DatabaseId;
  name: string;
  objective: string;
  location: string;
  target_categories: string[];
  target_qualified_leads: number;
  minimum_score: number;
  mission_budget_centavos: Centavos;
  status: MissionStatus;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Prospect {
  id: DatabaseId;
  public_id: PublicId;
  owner_id: DatabaseId;
  business_name: string;
  category: string;
  address: string | null;
  location: string;
  website: string | null;
  phone: string | null;
  rating: number | null;
  review_count: number | null;
  external_source: string | null;
  external_source_id: string | null;
  normalized_domain: string | null;
  contact_status: ContactStatus;
  status: ProspectStatus;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface MissionProspect {
  mission_id: DatabaseId;
  prospect_id: DatabaseId;
  discovery_source: string;
  discovered_at: IsoDateTime;
  mission_status: "CANDIDATE" | "ACTIVE" | "QUALIFIED" | "DISQUALIFIED" | "REJECTED" | "COMPLETED" | "DUPLICATE";
  rank: number | null;
}

export interface Evidence {
  id: DatabaseId;
  public_id: PublicId;
  owner_id: DatabaseId;
  prospect_id: DatabaseId;
  agent_run_id: DatabaseId | null;
  source_type: "WEBSITE" | "SEARCH_RESULT" | "BUSINESS_DIRECTORY" | "MANUAL" | "OTHER";
  source_url: string;
  page_title: string | null;
  observation_type: string;
  claim: string;
  observation: string;
  content_hash: string;
  captured_at: IsoDateTime;
}

export interface WebsiteResearch {
  id: DatabaseId;
  public_id: PublicId;
  owner_id: DatabaseId;
  mission_id: DatabaseId;
  prospect_id: DatabaseId;
  agent_run_id: DatabaseId;
  status: "COMPLETED" | "PARTIAL" | "FAILED" | "BLOCKED";
  requested_url: string;
  canonical_host: string | null;
  pages_attempted: number;
  pages_succeeded: number;
  stop_reason: "RESEARCH_COMPLETE" | "PAGE_LIMIT" | "TIME_LIMIT" | "POLICY_BLOCKED" | "TOOL_FAILURE";
  idempotency_key: string;
  started_at: IsoDateTime;
  completed_at: IsoDateTime;
}

export interface Qualification {
  id: DatabaseId;
  public_id: PublicId;
  prospect_id: DatabaseId;
  version: number;
  experience_gap_score: number;
  walkthrough_fit_score: number;
  commercial_fit_score: number;
  visual_property_score: number;
  contactability_score: number;
  penalty_score: number;
  final_score: number;
  priority: Priority;
  qualification_status: "QUALIFIED" | "DISQUALIFIED" | "INSUFFICIENT_EVIDENCE";
  confidence: number;
  experience_gap_summary: string;
  primary_marketing_problem: string;
  cinematicflight_opportunity: string;
  scoring_rule_version: "cinematicflight-v1";
  created_at: IsoDateTime;
}

export interface ProspectContact {
  id: DatabaseId;
  prospect_id: DatabaseId;
  type: ContactType;
  value: string;
  source_url: string;
  verification_status: ContactVerificationStatus;
  is_primary: boolean;
  created_at: IsoDateTime;
}

export interface Artifact {
  id: DatabaseId;
  prospect_id: DatabaseId;
  type: "WALKTHROUGH_CONCEPT" | "OUTREACH_DRAFT";
  version: number;
  content: string | { [key: string]: JsonValue };
  source_qualification_id: DatabaseId;
  delivery_status: "INTERNAL_UNSENT";
  created_at: IsoDateTime;
}

export interface AgentRun {
  id: DatabaseId;
  public_id: PublicId;
  mission_id: DatabaseId;
  prospect_id: DatabaseId | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "STOPPED" | "FAILED";
  started_at: IsoDateTime | null;
  completed_at: IsoDateTime | null;
  stop_reason: StopReason | null;
  step_count: number;
  llm_call_count: number;
  research_duration_ms: number;
  created_at: IsoDateTime;
}

export interface AgentDecision {
  id: DatabaseId;
  agent_run_id: DatabaseId;
  step_number: number;
  action: AgentAction;
  reason: string;
  target: string | null;
  expected_information: string | null;
  authority_result: "ALLOWED" | "DENIED" | "HUMAN_APPROVAL_REQUIRED" | "NOT_EVALUATED";
  budget_result: "ALLOWED" | "ALLOW_FREE" | "DENIED" | "NOT_APPLICABLE" | "NOT_EVALUATED";
  estimated_cost_centavos: Centavos;
  actual_cost_centavos: Centavos | null;
  confidence: number;
  state_before: Record<string, JsonValue>;
  state_after: Record<string, JsonValue>;
  created_at: IsoDateTime;
}

export interface CostEvent {
  id: DatabaseId;
  mission_id: DatabaseId;
  prospect_id: DatabaseId | null;
  agent_run_id: DatabaseId;
  provider: string;
  operation: string;
  estimated_cost_centavos: Centavos;
  actual_cost_centavos: Centavos | null;
  idempotency_key: string;
  created_at: IsoDateTime;
}

export interface Approval {
  id: DatabaseId;
  prospect_id: DatabaseId;
  qualification_id: DatabaseId;
  action: "APPROVE_PROSPECT" | "REJECT_PROSPECT" | "PROMOTE_TO_STUDIO" | "APPROVE_OUTREACH";
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  payload_hash: string;
  approved_by_owner_id: DatabaseId | null;
  created_at: IsoDateTime;
  resolved_at: IsoDateTime | null;
}

export interface Promotion {
  id: DatabaseId;
  prospect_id: DatabaseId;
  studio_inquiry_id: DatabaseId;
  approval_id: DatabaseId;
  created_at: IsoDateTime;
}
