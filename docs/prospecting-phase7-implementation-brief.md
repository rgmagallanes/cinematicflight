# Prospecting Phase 7 — Owner-Requested Website Research Queue

Status: Proposed implementation brief. Approval is required before implementation.

## 1. Goal

Phase 7 will let an authenticated Studio owner request bounded website research
for one eligible prospect and inspect the resulting queue record in Studio.
It creates an explicit handoff between the Studio owner API and the existing
Phase 6 signed runner; it does not put crawler credentials or execution in the
browser.

## 2. Scope

Implement only:

1. A durable, owner-scoped website-research request record and additive
   migration.
2. Studio owner API operations to create, list, and read requests.
3. A narrow Studio Prospecting control that creates a request only after an
   explicit confirmation, and shows its immutable request/result status.
4. A signed internal operation for the future runner to claim and finalize one
   request while preserving Phase 6 run, evidence, and idempotency controls.
5. Offline and MariaDB/PHP integration regression tests.

## 3. Explicit exclusions

Phase 7 must not add:

- autonomous scheduling, polling, or retries;
- browser-to-website fetching or browser access to internal bearer tokens;
- LLM analysis, qualification, contact enrichment, discovery, or scoring;
- outreach, contact-form submission, Studio promotion, or n8n workflow;
- production deployment or migration application.

The existing CLI runner remains manual and operator-invoked. A request is not a
promise that research has run.

## 4. Request model and lifecycle

Add `prospecting_website_research_requests` with at least:

- internal and public ID;
- owner, mission, and prospect IDs;
- requested website URL and normalized domain snapshot;
- status, request idempotency key and canonical request hash;
- optional claimed agent-run and completed website-research IDs;
- requested, claimed, completed, cancelled, created, and updated timestamps;
- bounded owner-facing reason or note, if retained.

Suggested statuses:

`PENDING` → `CLAIMED` → `COMPLETED | PARTIAL | BLOCKED | FAILED`

The owner may cancel only a `PENDING` request. A cancelled or terminal request
is immutable. A claim is allowed only once and must atomically bind the request
to an agent run. The result is bound only by the signed internal boundary after
the existing Phase 6 persistence succeeds.

Eligible creation requires the existing owner, mission membership, a `RUNNING`
mission, a `RESEARCHING` prospect, and an official HTTPS URL whose normalized
domain is already stored for that prospect. One active (`PENDING` or `CLAIMED`)
request per owner/mission/prospect is allowed.

## 5. API boundary

Studio owner API:

- `GET prospecting-website-research-requests` by owner-scoped mission,
  prospect, or request ID;
- `POST prospecting-website-research-requests` to create an explicit request;
- `PATCH prospecting-website-research-requests` to cancel a pending request.

These writes require the existing Studio session and CSRF protection. The API
must never start a fetch, create a run, expose a service token, or return data
belonging to another owner.

Signed internal agent API:

- `CLAIM_WEBSITE_RESEARCH_REQUEST` to lock and bind one pending request;
- extend the existing result persistence operation to require and terminally
  update the claimed request.

Claim and finalization require the existing configured per-owner bearer token,
request-ID replay ledger, mission/prospect/run consistency, and fail-closed
configuration. The runner must use the request public ID as a stable source for
its research idempotency key, not accept arbitrary queue instructions from page
content.

## 6. Studio interaction

Add a small owner-facing Research request area to the prospect detail only. It
must show:

- eligibility or the exact missing prerequisite;
- the official website domain to be researched;
- clear limits: bounded first-party HTTPS research, evidence only, no outreach;
- an explicit confirmation before creation;
- pending, claimed, terminal, and cancelled status;
- a link to the existing read-only research summary and evidence after result
  persistence.

It must not use optimistic success. Server failure stays visibly recoverable.
The Studio UI must not imply that a `PENDING` request is actively running.

## 7. Atomicity and recovery

- Create requests in a short transaction after all owner/lifecycle checks.
- Claim with `SELECT ... FOR UPDATE`; only one claim succeeds.
- The Phase 6 research result and terminal queue update commit in the same
  short transaction, after network work has finished.
- An internal replay returns the original claim or result for identical input;
  changed payloads conflict.
- A runner may release a claim only before external fetching begins. Once a
  fetch begins, a failure must be a terminal audited result rather than silently
  returning the request to pending.

## 8. Required tests

- owner creates an eligible request;
- missing website, domain, mission membership, mission state, and prospect
  state are rejected;
- duplicate active request is rejected or idempotently replayed;
- cross-owner read, create, cancel, claim, and finalization are denied;
- pending request cancellation; claimed and terminal cancellation rejection;
- two concurrent claims yield exactly one claim;
- claim binds the correct mission, prospect, and run;
- each terminal Phase 6 result updates the corresponding request;
- request and signed-ingest replay/conflict behavior;
- Studio UI never starts research directly and shows no false success;
- existing Phase 1–6, repository, build, Sites, and Docker PHP/MariaDB tests.

## 9. Acceptance criteria

Phase 7 is complete only when an owner can deliberately queue one eligible
research request, an authorized manual runner can claim and finalize it through
the signed internal boundary, the owner can see the final evidence-backed
status, and no autonomous execution or external communication capability has
been introduced.

## 10. Decisions requested before implementation

1. Use a durable queue record rather than a browser button that invokes the
   runner directly.
2. Permit only one active request per owner, mission, and prospect.
3. Keep the runner manual; do not add a scheduler or queue worker.
4. Require the existing `RUNNING` mission and `RESEARCHING` prospect lifecycle
   state before a request can be created.
5. Allow cancellation only before internal claim.
6. Bind finalization to the existing Phase 6 result transaction so request and
   evidence status cannot diverge.

Implementation must not begin until these decisions and this brief are approved.
