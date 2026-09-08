import { researchWebsite, type ResearchResult, type ResearchTransport } from "./website-research.ts";

/**
 * A confirmed client error means the ingest service replied that persistence did
 * not happen. Network errors are deliberately not treated this way: the caller
 * must retry the same idempotency key because the server outcome is unknown.
 */
export class ConfirmedIngestError extends Error {}

export type InternalIngest = (operation: string, payload: Record<string, unknown>) => Promise<Record<string, any>>;

export interface ManualWebsiteResearchRunInput {
  ingest: InternalIngest;
  transport: ResearchTransport;
  missionPublicId: string;
  prospectPublicId: string;
  requestedUrl: string;
  idempotencyKey: string;
}

export interface ManualWebsiteResearchRunResult {
  run_public_id: string;
  research: ResearchResult;
  persisted: Record<string, any>;
}

/**
 * Bounded, operator-invoked Phase 6 orchestration. It has no scheduler or
 * autonomous retry loop. A known rejected persistence request terminally fails
 * its just-created run; an ambiguous transport failure is left for idempotent
 * replay, so a potentially completed run is never overwritten as failed.
 */
export async function runManualWebsiteResearch(input: ManualWebsiteResearchRunInput): Promise<ManualWebsiteResearchRunResult> {
  const created = await input.ingest("CREATE_RUN", {
    mission_public_id: input.missionPublicId,
    prospect_public_id: input.prospectPublicId,
    status: "RUNNING",
  });
  const runPublicId = String(created.run?.public_id ?? "");
  if (!runPublicId) throw new Error("Internal ingest did not return an agent run public ID.");

  const research = await researchWebsite({ requestedUrl: input.requestedUrl, transport: input.transport });
  const payload = {
    mission_public_id: input.missionPublicId,
    prospect_public_id: input.prospectPublicId,
    run_public_id: runPublicId,
    idempotency_key: input.idempotencyKey,
    requested_url: research.requested_url,
    canonical_host: research.canonical_host,
    status: research.status,
    stop_reason: research.stop_reason,
    pages_attempted: research.pages_attempted,
    pages_succeeded: research.pages_succeeded,
    started_at: research.started_at,
    completed_at: research.completed_at,
    evidence: research.evidence,
    events: research.events,
  };

  try {
    const persisted = await input.ingest("PERSIST_WEBSITE_RESEARCH", payload);
    return { run_public_id: runPublicId, research, persisted };
  } catch (error) {
    if (error instanceof ConfirmedIngestError) {
      await input.ingest("UPDATE_RUN", {
        run_public_id: runPublicId,
        status: "FAILED",
        step_count: research.events.length,
        llm_call_count: 0,
        research_duration_ms: Math.max(0, Date.parse(research.completed_at) - Date.parse(research.started_at)),
        stop_reason: "TOOL_FAILURE",
      });
    }
    throw error;
  }
}
