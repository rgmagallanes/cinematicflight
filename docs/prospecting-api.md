# Prospecting Phase 3 persistence

Phase 3 adds private, owner-scoped MariaDB persistence. It does not add a Studio
screen, external discovery, agent execution, LLM calls, enrichment, outreach, or
promotion into `studio_inquiries`.

## Installation

After backing up the Studio database and installing `database/mysql-schema.sql`,
apply `database/mysql-prospecting-v1.sql`. The migration is additive and uses the
existing InnoDB, bigint ID, timestamp, and `utf8mb4_unicode_ci` conventions.

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
  calculate the v1 weighted score and penalties, and transition the prospect in
  one transaction. Submitted final score, priority, and result fields are ignored.
- Approval payloads are canonicalized and SHA-256 hashed server-side. Approval
  and its applicable prospect transition commit together. Approval never sends
  or promotes anything.
- Cost idempotency keys are unique per owner. Exact repeats are safe; altered
  reuse returns `409`.
- Cost summaries subtract committed actual costs from mission budget using
  integer centavos. Reservations remain the future persistence adapter's work;
  the Phase 2 in-memory reservation model is not presented as database-atomic.
