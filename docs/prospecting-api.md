# Prospecting persistence API

Phases 3 and 3.5 add private, owner-scoped MariaDB persistence. They do not add a Studio
screen, external discovery, agent execution, LLM calls, enrichment, outreach, or
promotion into `studio_inquiries`.

## Installation

After backing up the Studio database and installing `database/mysql-schema.sql`,
apply `database/mysql-prospecting-v1.sql`, followed by
`database/mysql-prospecting-execution-v1.sql`, the Phase 6 and 7 additive migrations,
and `database/mysql-prospecting-qualification-provenance-v1.sql`. These migrations are additive and use the
existing InnoDB, bigint ID, timestamp, and `utf8mb4_unicode_ci` conventions.

The production backup, deployment, validation, and recovery procedure is in
`docs/prospecting-production-migration.md`.

The PHP API intentionally fails closed if these tables are absent. It has no
browser-storage or demo-data fallback.

## Existing-query API routes

The repository routes PHP operations through `/api/index.php?action=...` rather
than path rewriting. Prospecting follows that convention:

| Action | Methods | Identifier query |
| --- | --- | --- |
| `prospecting-missions` | `GET`, `POST`, `PATCH` | `id` for one mission |
| `prospecting-prospects` | `GET`, `POST`, `PATCH` | `id` for one prospect |
| `prospecting-mission-prospects` | `GET`, `POST` | `mission_id` |
| `prospecting-evidence` | `GET`, `POST` | `prospect_id` |
| `prospecting-contacts` | `GET`, `POST` | `prospect_id` |
| `prospecting-qualifications` | `GET`, `POST` | `prospect_id` |
| `prospecting-approvals` | `GET`, `POST` | `prospect_id` |
| `prospecting-cost-events` | `POST` | none |
| `prospecting-costs` | `GET` | `mission_id` |
| `prospecting-runs` | `GET` | `mission_id`, `prospect_id`, or `id` |
| `prospecting-decisions` | `GET` | `run_id` |
| `prospecting-artifacts` | `GET` | `prospect_id` and optional `version` |
| `prospecting-reservations` | `GET` | `mission_id`, `prospect_id`, or `id` |
| `prospecting-website-research` | `GET` | `prospect_id` or `id` |
| `prospecting-website-research-requests` | `GET`, `POST`, `PATCH` | `prospect_id`, `mission_id`, or `id` |

All identifiers are public IDs. Every lookup also includes the authenticated
Studio owner ID, so another owner's valid public ID receives the same `404` as a
missing resource. Mutations require the existing Studio CSRF token and accept a
JSON object no larger than 64 KB.

## Integrity rules

- New missions begin in `DRAFT`; new prospects begin in `DISCOVERED`.
- Generic patches use the Phase 1 transition maps. Qualification-derived states
  can only come from the qualification endpoint; approval states require an
  append-only approval record; promotion is unavailable.
- Qualification writes lock the prospect, allocate the next snapshot version,
  calculate the v1 weighted score and penalties, insert immutable provenance,
  and transition the prospect in one transaction. Each write requires one or
  more same-prospect evidence references or labelled manual assessments with a
  reason. Submitted final score, priority, and result fields are ignored.
- Approval payloads are canonicalized and SHA-256 hashed server-side. Approval
  and its applicable prospect transition commit together. Approval never sends
  or promotes anything.
- Cost idempotency keys are unique per owner. Exact repeats are safe; altered
  reuse returns `409`.
- Cost summaries subtract committed actual costs from mission budget using
  integer centavos. The Studio cost-write route locks the owner row so its
  committed spend cannot race an internal reservation authorization.

## Internal agent mutation boundary

`POST /api/index.php?action=prospecting-agent-ingest` is a server-to-server-only
boundary. It is disabled by default and does not accept browser session or CSRF
authentication. The bearer credential is a dedicated, per-owner 64-hex service
token and must be transported only over HTTPS. A durable owner/request-ID ledger
binds each request ID to the operation and canonical payload hash, returning the
recorded response for an identical retry. Reusing a request ID with a different
payload returns `409`.

The narrow operation vocabulary is `CREATE_RUN`, `UPDATE_RUN`,
`APPEND_DECISION`, `CREATE_ARTIFACT`, `RESERVE_BUDGET`, `COMMIT_RESERVATION`,
`RELEASE_RESERVATION`, and `PERSIST_WEBSITE_RESEARCH`. Website research result
persistence requires a running mission, a researching prospect that belongs to
that mission, and a running agent run linked to both. It persists only bounded,
already-collected observations; it never accepts a browser crawler request.
Owner isolation is checked again for every referenced mission, prospect, run,
decision, artifact, reservation, and research record.

The Studio owner API can read runs, decisions, artifacts, and reservation/cost
information. It cannot perform the internal mutations. Artifacts are restricted
to versioned `WALKTHROUGH_CONCEPT` and `OUTREACH_DRAFT` records and are always
reported as `INTERNAL_UNSENT`.

Website-research requests are owner-controlled queue records, not browser crawl
commands. Studio can create, inspect, or cancel a pending request. Only the
signed internal boundary can claim it and bind its run; result persistence then
updates the claimed request in the same transaction as the research record.

Reservation authorization locks the owner row and then the mission row in one
transaction. The owner lock serializes monthly authorizations across missions;
the mission lock protects its ceiling. The calculation includes committed cost
events plus unexpired active reservations. Expired holds are recovered during
internal reservation operations. Above-estimate commits repeat both checks;
when capacity is insufficient, the reservation becomes
`RECONCILIATION_REQUIRED`, no cost event is inserted, and the endpoint returns
an explicit conflict.
