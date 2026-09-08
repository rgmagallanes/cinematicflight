# Prospecting Phase 6 — Website Research and Evidence Capture

Status: Proposed implementation brief. Approval is required before implementation.

## 1. Goal

Phase 6 will add manually initiated, bounded research of the official website already stored for one existing prospect. It will collect observed website facts and persist them as Prospecting evidence.

This phase will not add discovery providers, LLM analysis, qualification decisions, autonomous agent execution, outreach, form submission, Studio promotion, n8n orchestration, JavaScript browser automation, or production deployment.

## 2. Execution boundary

Website fetching must not be exposed as a general browser-authenticated mutation. The existing signed internal agent boundary will remain the only mutation boundary for research execution and persistence.

The recommended initial implementation is:

1. A deterministic, offline-testable research core under `services/prospecting-agent/`.
2. A small manually invoked CLI runner that performs bounded fetching without introducing a web server or framework.
3. A narrow signed internal ingest operation that persists a validated research result, evidence, run counters, and decisions.
4. Read-only Studio owner API support for research summaries and evidence.

Network work must not run while a MariaDB transaction or database row lock is held. The fetch completes first; the validated result is then persisted atomically.

No Phase 6 Studio execution control is proposed. A later phase may add a request/queue control after the execution model is proven.

## 3. Preconditions and lifecycle

- The prospect must belong to the authenticated owner represented by the internal token.
- The prospect must have a normalized official HTTPS website.
- The prospect must be in `RESEARCHING` status.
- The research operation may create evidence, update its own research record, update run counters, and append governance decisions.
- It must not qualify, approve, reject, promote, or contact a prospect.
- Existing evidence remains immutable.
- A completed or partial run records observations only. It must not infer that something is absent from the entire website.

## 4. Fetch safety policy

The first implementation should use the following fail-closed limits:

- HTTPS only.
- No URL credentials or fragments.
- Standard HTTPS port only.
- Exact normalized hostname only, including redirects and discovered pages.
- Maximum 3 redirects per request.
- Maximum 8 fetched pages per research run.
- Maximum 1 MiB decoded response body per page.
- Maximum 15 seconds per request and 60 seconds for the complete run.
- Bounded response headers.
- `GET` and `HEAD` only.
- Accepted content types: `text/html` and `application/xhtml+xml`.
- No cookies, authentication forwarding, browser-session forwarding, secret-bearing headers, form submission, downloads, JavaScript execution, or embedded-resource fetching.
- Reject binary documents, archives, PDFs, scripts, media, and unknown content types.
- Respect `robots.txt`; a denial is recorded as a bounded stop result, not bypassed.

Before every connection, including redirects and selected internal pages, the implementation must:

1. Canonicalize the hostname, including IDNA handling.
2. Resolve all A and AAAA records.
3. Reject the target if any answer is loopback, private, link-local, multicast, reserved, unspecified, documentation-only, metadata-service, or otherwise non-public.
4. Pin the validated public address used by the connection so DNS cannot be changed between validation and connection.
5. Revalidate each redirect and next-page target independently.

Tests must cover IPv4-mapped IPv6 and alternate numeric IPv4 representations. A target with mixed public and prohibited DNS answers must be rejected.

## 5. Deterministic navigation

The stored official website URL is fetched first. Further pages are selected only from same-host links matching an allowlist of likely property information categories:

- accommodation or rooms
- amenities or facilities
- gallery
- about or property
- contact
- virtual tour

Links must be resolved with a standards-compliant URL parser, stripped of fragments and known tracking parameters, canonicalized, deduplicated, sorted deterministically, and capped before fetching. Dangerous and unsupported schemes are rejected.

The crawler must not follow arbitrary first links, external domains, login areas, checkout flows, forms, downloads, or user-generated navigation instructions found in page content.

## 6. Evidence rules

Website content is untrusted input. Text found on a page can describe an observed fact, but it can never instruct the system, expand its authority, change its limits, or authorize an action.

The research core may emit these deterministic observation types:

- `PAGE_METADATA`
- `GALLERY`
- `ACCOMMODATION`
- `AMENITY`
- `CONTACT`
- `MATTERPORT_EMBED`
- `INTERACTIVE_EXPERIENCE`
- `VIDEO_EMBED`
- `STREET_VIEW_EMBED`
- `FLOORPLAN_MARKER`

Each saved evidence row must use the existing `prospecting_evidence` model and include the actual final fetched URL, page title, observation type, bounded claim, bounded observation, normalized content hash, capture time, prospect, owner, agent run, and website research record.

Claims must describe what the fetched page contained, for example: “The fetched page contained a Matterport embed.” They must not claim that an experience, contact method, or amenity is absent from the whole site based on a bounded crawl.

Only the minimum useful metadata or short source snippet should be retained. Complete copyrighted page HTML must not be stored as evidence.

LLM output is not evidence, and no LLM is used in this phase.

## 7. Persistence model

Add an additive `prospecting_website_research` table in a Phase 6 migration. It should contain:

- internal and public IDs
- owner ID
- prospect ID
- agent run ID, where applicable
- status
- requested URL and normalized hostname
- page attempt and success counts
- stop or failure code
- idempotency key and request hash
- started, completed, created, and updated timestamps

Suggested statuses are `PENDING`, `RUNNING`, `COMPLETED`, `PARTIAL`, `FAILED`, and `BLOCKED`.

The migration must create the research table before adding the nullable `website_research_id` relationship and foreign key to `prospecting_evidence`. It must not create a second evidence table.

Research result persistence should use one short transaction after network activity has ended. The transaction validates ownership and lifecycle state, updates the research record, inserts immutable evidence, updates run counters, and appends decisions. Any failure rolls back the result set.

Repeated requests with the same owner, idempotency key, and identical request hash return the existing research record. Reuse of the key with a materially different request returns a conflict.

## 8. Governance and accounting

- Every fetch attempt and terminal outcome is represented by an append-only agent decision using the existing action and stop-reason vocabulary, extended only if the current contracts cannot accurately represent website research.
- Existing run step, duration, and tool counters are updated through the internal persistence boundary.
- Ordinary direct HTTP fetching has no provider charge and creates no cost reservation.
- If a future paid provider is introduced, it must use the existing reserve/commit/release budget workflow before execution.
- Tool limits, time limits, policy blocks, and fetch failures must be explicit terminal or partial results.

## 9. API separation and authentication

Studio owner API:

- read research summaries by owner-scoped prospect
- read persisted evidence
- read associated runs and decisions through existing read models

Signed internal API:

- accept a narrow, validated research-result persistence operation
- require the existing dedicated 64-hex bearer token and configured owner
- remain disabled when configuration is incomplete
- require a unique request ID and durable replay protection
- return narrow receipts only
- never log tokens or source page contents

The internal endpoint must not become a public crawler proxy and must not accept arbitrary targets unrelated to an owner-scoped prospect’s stored official website.

## 10. Required tests

All website fetch tests should use an injected fake HTTP/DNS transport. The default test suite must not depend on the public internet.

### URL and network policy

- valid HTTPS URL
- HTTP, credentials, fragments, and nonstandard ports rejected
- localhost and IPv4/IPv6 loopback rejected
- private, link-local, multicast, reserved, unspecified, documentation, and metadata addresses rejected
- decimal, octal, hexadecimal, and mixed numeric-host tricks rejected
- IPv4-mapped IPv6 rejected when mapped to a prohibited address
- IDN canonicalization
- DNS rebinding defense and connection pinning
- mixed public/prohibited DNS answers rejected
- redirect revalidation
- same-host redirect accepted and cross-host redirect rejected

### Fetch limits and navigation

- content-type allowlist
- body-size limit before and during streaming/decompression
- header, redirect, page, request-time, and run-time limits
- deterministic relative URL resolution
- fragment and tracking-parameter removal
- canonical deduplication and deterministic ordering
- unsupported scheme and download rejection
- robots denial behavior

### Extraction and evidence

- each allowed observation type
- actual final source URL and title persisted
- stable normalized content hashes
- bounded snippets rather than full HTML
- page instructions are treated as text and never executed
- incomplete research does not create site-wide absence claims

### Persistence and security

- migration, indexes, and foreign keys on MariaDB
- completed, partial, failed, and blocked states
- transactional result persistence
- identical idempotent replay
- conflicting replay
- owner isolation
- cross-owner prospect and run references rejected
- invalid lifecycle state rejected
- internal authentication disabled/fail-closed behavior
- durable request replay protection

### Regression

- Phase 1–5 Prospecting tests
- existing repository tests
- Docker PHP/MariaDB integration tests
- public and Studio production builds
- `git diff --check`

## 11. Migration and deployment requirements

Phase 6 implementation must update the existing Prospecting production migration guide with backup, additive migration order, validation queries, compatibility notes, rollback limitations, and restore procedure.

No migration or application deployment is part of Phase 6 implementation work. Production deployment requires a separate approval and verified backup.

## 12. Acceptance criteria

Phase 6 is complete only when:

- one synthetic local fixture can be researched through the manually invoked runner;
- all fetching is bounded by the approved policy;
- observations are saved as immutable, owner-scoped evidence through the signed internal boundary;
- the stored research summary and evidence can be read through the existing Studio owner boundary;
- no LLM, qualification authorization, outreach, autonomous loop, or promotion is present;
- all required tests and regressions have been run and exact results reported.

## 13. Decisions requested before implementation

Approval is requested for these defaults:

1. Restrict every request and redirect to the exact normalized hostname, rather than the wider registrable domain.
2. Respect `robots.txt` and stop safely when it denies access.
3. Use a manually invoked CLI runner plus signed result ingest, rather than synchronous crawling in PHP.
4. Use limits of 8 pages, 1 MiB decoded body per page, 3 redirects per request, 15 seconds per request, and 60 seconds per run.
5. Keep Phase 6 execution out of the Studio UI; expose stored results read-only.

Implementation must not begin until these decisions and this brief are approved.
