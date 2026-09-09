# Prospecting Phase 8 — Evidence-Grounded Owner Qualification

Status: Revised proposed implementation brief. Approval is required before implementation.

## 1. Goal and boundaries

Phase 8 lets an authenticated Studio owner review persisted evidence and append
a traceable qualification through the existing deterministic scoring model.

```text
Research != Qualification
Qualification != Approval
Approval != Outreach
```

The owner remains accountable. This phase adds no LLM, autonomous qualification,
runner, website fetch, discovery, contact enrichment, outreach, form submission,
Studio promotion, automatic approval, or automatic transition to pending approval.

## 2. Existing qualification architecture to preserve

`POST prospecting-qualifications&prospect_id=...` is the existing owner-scoped,
CSRF-protected write boundary. It locks the prospect row, allocates the next
version, calculates the result server-side, inserts an immutable qualification,
and updates the prospect lifecycle in one transaction.

It currently permits append only while the prospect is `RESEARCHING`. Requalification
therefore uses an explicit existing lifecycle return to `RESEARCHING`, then appends
V2, V3, and later versions. Earlier qualifications are immutable and are read
newest-first by version. No current-pointer or supersession column is required.

## 3. Current scoring behavior — unchanged

Rule version remains `cinematicflight-v1`:

```text
base_score = experience_gap * 0.30 + walkthrough_fit * 0.25
           + commercial_fit * 0.20 + visual_property * 0.15
           + contactability * 0.10
final_score = clamp(round(base_score + approved_penalties), 0, 100)
```

Components are whole integers 0–100. Priority is `HOT` 90–100, `HIGH` 75–89,
`MEDIUM` 60–74, and `LOW` 0–59. Approved server-mapped penalty identifiers are:

| Identifier | Current rule |
| --- | --- |
| `STRONG_EXISTING_WALKTHROUGH` | -20 |
| `WEAK_PHYSICAL_SPACE_RELEVANCE` | -30 |
| `NO_OFFICIAL_WEBSITE` | -10 |
| `DUPLICATE` | disqualify; never a numeric penalty |

The current PHP endpoint uses a hard-coded threshold of 75; it does not read the
mission `minimum_score`. Phase 8 preserves that behavior. `evidence_sufficient=false`
returns `INSUFFICIENT_EVIDENCE`; otherwise duplicate or a score below 75 returns
`DISQUALIFIED`, and all other results return `QUALIFIED`.

## 4. Durable qualification provenance — required

Add an additive owner-scoped `prospecting_qualification_provenance` table. The
current qualification schema cannot provide evidence-reference integrity.

It must contain consistent internal/public IDs, owner ID, qualification ID,
prospect ID, nullable evidence ID, `provenance_type`, optional
`assessment_component`, nullable bounded `manual_assessment_reason`, and created
timestamp. Types: `EVIDENCE`, `MANUAL_ASSESSMENT`. Suggested components:
`EXPERIENCE_GAP`, `WALKTHROUGH_FIT`, `COMMERCIAL_FIT`, `VISUAL_PROPERTY`,
`CONTACTABILITY`, `PENALTY`, `NARRATIVE`.

`EVIDENCE` requires a persisted evidence record from the same owner and prospect.
`MANUAL_ASSESSMENT` requires a bounded reason and no evidence ID. Never copy page
content, observations, or LLM output. Historical provenance must never be rebound
to newer evidence.

## 5. API, authority, and atomicity

Extend the existing qualifications API and read model; do not add a parallel API.
Studio submits only components, stable penalty identifiers, evidence sufficiency,
confidence, narratives, provenance selections, and manual reasons.

The server maps penalty identifiers and remains authoritative for weights,
penalty values, final score, priority, threshold, qualification status, lifecycle,
version, and timestamps. Forged final score, priority, numeric penalty, threshold,
version, or lifecycle values must be ignored or rejected consistently.

Qualification allocation, qualification insertion, provenance insertion, and
prospect lifecycle transition must commit or roll back together under existing
MariaDB prospect-row locking. The migration is additive. Do not apply it to
production in this phase.

## 6. Insufficient evidence and Studio behavior

`INSUFFICIENT_EVIDENCE` remains a human-controlled outcome. Provenance must make
clear whether there is no usable evidence, insufficient coverage, conflicting or
inconclusive evidence, or additional owner review is required. Use a labelled
manual assessment reason—do not add new statuses.

Studio renders selected evidence with stored source URL, observation, and capture
time, distinctly from owner assessment. It may show an **Estimated score** only,
with “Final score is calculated by the server.” Persisted score, priority, status,
version, and timestamp appear only after success. Recoverable errors preserve all
unsaved inputs. External URLs open only by explicit owner action; review never
fetches or embeds them.

## 7. Required tests

- formula, penalties, clamp, priority, hard-coded 75 threshold, duplicate, and
  insufficient-evidence behavior;
- forged `final_score=100`, priority, numeric penalty, threshold, version, and
  lifecycle fields cannot override server authority;
- invalid components, identifiers, provenance types, and manual reasons;
- same-owner but different-prospect evidence is rejected, as are cross-owner IDs;
- manual assessment cannot masquerade as observed evidence;
- V1/V2 immutable requalification, version allocation, and each version’s
  historical provenance;
- atomic rollback if provenance cannot persist;
- provisional UI, no false success, and input recovery;
- Phase 1–7, repository, build, Sites, and Docker MariaDB/PHP regression.

## 8. Acceptance criteria and approval decisions

Phase 8 is complete only when an owner creates an evidence-grounded, versioned
qualification with durable provenance and a server-calculated result, without
automation or external communication.

Approval is requested to:

1. add durable provenance;
2. accept stable penalty identifiers rather than arbitrary numeric penalties;
3. preserve the current hard-coded 75 threshold and lifecycle behavior;
4. require evidence provenance or labelled manual assessment with reason; and
5. keep approval as a separate explicit owner action.

Implementation must not begin until this revised brief is explicitly approved.
