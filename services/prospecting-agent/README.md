# CinematicFlight Prospecting domain and governance core

Phases 1 and 2 contain contracts and deterministic offline utilities only. They have no
runtime server, database adapter, crawler, discovery provider implementation,
LLM integration, n8n connection, Studio route, promotion operation, or outreach
transport.

The package uses Node's built-in TypeScript type stripping and test runner, so it
adds no repository dependency or framework. Its source remains portable to a
future Docker-compatible service.

## Contract rules

- JSON payloads use `snake_case` to match the existing PHP/SQL boundary.
- Public IDs use an entity prefix followed by a lowercase UUID, for example
  `prospect_550e8400-e29b-41d4-a716-446655440000`.
- Currency is a non-negative safe integer of PHP centavos. `284` means PHP 2.84.
- Evidence stores bounded observations from real sources. Source content is
  untrusted data and cannot grant authority or provide tool instructions.
- LLM output is an artifact or assessment, never evidence, permission, budget
  authorization, a lifecycle transition, or a final score.
- Outreach artifacts are always `INTERNAL_UNSENT` in this phase.

## Phase 2 governance composition

Every proposed future action is evaluated independently by payload validation,
authority policy, prospect state/action policy, execution limits, and mission
plus monthly budget policy. Every layer must allow the action. Missing and
unknown rules default to deny. The result is a structured trace; it does not
execute a tool.

Website text is always `UNTRUSTED_EXTERNAL_CONTENT`. It may be evidence, factual
input, analysis text, or source material. It can never grant authority, change a
budget or lifecycle rule, provide system instructions, or authorize code.

### State/action policy

```text
DISCOVERED  -> DISCOVER_MORE, INSPECT_WEBSITE, SAVE_EVIDENCE, SAVE_PROSPECT
RESEARCHING -> DISCOVER_MORE, INSPECT_WEBSITE, INSPECT_PAGE,
               DETECT_EXISTING_EXPERIENCE, FIND_CONTACT,
               ANALYZE_EXPERIENCE_GAP, CALCULATE_SCORE,
               SAVE_EVIDENCE, SAVE_PROSPECT
QUALIFIED   -> GENERATE_WALKTHROUGH, DRAFT_OUTREACH, REQUEST_APPROVAL,
               SAVE_EVIDENCE, SAVE_PROSPECT
all other prospect states -> no autonomous actions
```

An action must also pass authority policy. `DISCOVER_MORE` additionally requires
explicit mission permission, remaining discovery capacity, and provider budget
authorization. `REQUEST_APPROVAL` can create a human gate but cannot resolve it.
External outreach, promotion, purchasing, arbitrary HTTP, shell execution, and
website-supplied code remain forbidden.

### Budget reservations

Currency is a non-negative safe integer of PHP centavos. The default monthly
ceiling is 200,000 centavos (PHP 2,000). Paid actions must fit both the mission
and monthly ceilings after spent and reserved amounts. Free actions return
`ALLOW_FREE` and reserve nothing.

`reserveCost` holds an estimate against both ceilings. `commitCost` converts the
reservation to actual spend and releases unused capacity; `releaseReservation`
removes a hold after an unbilled failure. An actual cost above its estimate may
commit only if it still fits both ceilings. Otherwise `DENY_OVERAGE` leaves the
original reservation in place and marks the result for reconciliation. A future
persistence adapter must perform reserve/commit/release atomically; this phase
provides no concurrency mechanism by itself.

### Execution and loop limits

Counters represent already-completed work. A counter equal to its maximum means
the next action must stop. Defaults are 12 steps, 8 pages, 3 LLM calls, and 90
research seconds per lead. The limit evaluator uses this precedence: steps,
pages, LLM calls, then elapsed time.

An operation fingerprint is a canonical representation of action, normalized
target, and relevant arguments. By default, attempting the same operation a
second time at the same state and evidence versions returns
`STOP_REPEATED_ACTION`. A changed state or evidence version is meaningful
progress and starts a new comparison window.

### Stopping-rule precedence

The stopping engine evaluates, in order: tool/run failure; terminal lifecycle;
duplicate; disqualification; pending human approval; qualification; a paid next
action denied by budget; execution limits; repeated action; insufficient
evidence; otherwise continue. The state/action policy separately blocks every
action in pending, rejected, promoted, failed, disqualified, and insufficient-
evidence states.

### Score governance

External analysis may supply only the five component assessments. Deterministic
code applies weights, penalties, clamping, priority, and the qualification
threshold. An external `final_score` field is explicitly ignored and reported
in `ignoredExternalFields`.

## Prospect lifecycle

```text
DISCOVERED -> RESEARCHING
RESEARCHING -> INSUFFICIENT_EVIDENCE | DISQUALIFIED | QUALIFIED | FAILED
INSUFFICIENT_EVIDENCE -> RESEARCHING
DISQUALIFIED -> RESEARCHING
FAILED -> RESEARCHING
QUALIFIED -> PENDING_APPROVAL | RESEARCHING
PENDING_APPROVAL -> APPROVED | REJECTED | RESEARCHING
REJECTED -> RESEARCHING
APPROVED -> PROMOTED_TO_STUDIO | RESEARCHING
PROMOTED_TO_STUDIO -> terminal
```

Transitions back to `RESEARCHING` are explicit retry/invalidation paths. They are
not automatic; later phases must record the reason as an agent decision or owner
action. Promotion remains contract-only and requires a separate approved action.

## Mission lifecycle

```text
DRAFT -> READY | CANCELLED
READY -> RUNNING | CANCELLED | FAILED
RUNNING -> PAUSED | COMPLETED | CANCELLED | FAILED | BUDGET_EXHAUSTED
PAUSED -> READY | RUNNING | CANCELLED | FAILED | BUDGET_EXHAUSTED
FAILED -> READY
BUDGET_EXHAUSTED -> READY | CANCELLED
COMPLETED -> terminal
CANCELLED -> terminal
```

Returning from `FAILED` or `BUDGET_EXHAUSTED` to `READY` represents an explicit
owner-authorized retry or budget amendment in a later phase.

## Scoring rule `cinematicflight-v1`

The weighted raw score is:

```text
Experience Gap 30%
+ Walkthrough Fit 25%
+ Commercial Fit 20%
+ Visual Property 15%
+ Contactability 10%
```

Applicable penalties are then added, and the result is rounded to the nearest
integer and clamped to 0-100. Duplicate status is a deterministic disqualifier,
not an LLM-selected numerical penalty. The default qualification threshold is 75.

## Discovery boundary

`DiscoveryProvider` defines the future adapter boundary. The first adapter will
be a manual seed/import provider. No provider is implemented in Phase 1.
