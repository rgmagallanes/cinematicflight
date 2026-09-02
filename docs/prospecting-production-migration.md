# Prospecting production migration and recovery

This is an operations plan, not a record of deployment. Phase 3.5 does not run
these steps against production.

## Preconditions and backup

1. Schedule a quiet migration window and confirm the current Studio deployment
   still uses the owner-scoped PHP API.
2. Disable the prospecting agent ingest flag. Do not configure tokens in a
   browser-visible file or commit them to Git.
3. Take a full logical MariaDB backup before either prospecting migration. For
   example, run `mysqldump` with credentials supplied through the hosting
   account's protected mechanism, not on the command line, and include routines,
   triggers, and a consistent transaction.
4. Copy the encrypted backup outside the deployment directory and record its
   checksum, database name, server version, and capture time.
5. Verify the dump can be read and rehearse restoration into a separate test
   database before changing production.

## Deployment order

1. Back up and verify the backup as described above.
2. Apply `database/mysql-prospecting-v1.sql`.
3. Apply `database/mysql-prospecting-execution-v1.sql`.
4. Run the validation queries below before deploying PHP that depends on the
   new tables.
5. Deploy the PHP files with `prospecting_agent_ingest_enabled` still `false`.
   The existing Studio remains compatible because both migrations are additive
   and older application code ignores the new tables.
6. Configure a dedicated current token per allowed owner in the private
   account-level configuration outside `public_html`. Set the monthly ceiling
   explicitly in integer PHP centavos.
7. Exercise one authenticated, no-charge request with a unique request ID in the
   controlled environment. Verify owner isolation and the replay response.
8. Enable ingest only after those checks pass. Do not enable an agent loop,
   crawler, LLM, outreach, or promotion as part of this migration.

## Validation queries

Run these as a database administrator and inspect the result rather than merely
checking command exit status:

```sql
SHOW TABLES LIKE 'prospecting_%';
SHOW CREATE TABLE prospecting_budget_reservations;
SHOW CREATE TABLE prospecting_agent_ingest_requests;

SELECT COUNT(*) AS orphan_missions
FROM prospecting_budget_reservations r
LEFT JOIN prospecting_missions m ON m.id = r.mission_id
WHERE m.id IS NULL;

SELECT owner_id, idempotency_key, COUNT(*) AS duplicate_count
FROM prospecting_budget_reservations
GROUP BY owner_id, idempotency_key
HAVING COUNT(*) > 1;

SELECT owner_id, request_id, COUNT(*) AS duplicate_count
FROM prospecting_agent_ingest_requests
GROUP BY owner_id, request_id
HAVING COUNT(*) > 1;

SELECT COUNT(*) AS invalid_currency_rows
FROM prospecting_budget_reservations
WHERE estimated_cost_centavos < 0
   OR reserved_cost_centavos < 0
   OR actual_cost_centavos < 0;
```

All orphan, duplicate, and invalid-currency results must be zero. Confirm the
reservation table has the unique `(owner_id, idempotency_key)` key and the
ingest ledger has the unique `(owner_id, request_id)` key.

## Locking and accounting behavior

Each internal mutation starts a MariaDB transaction and locks the owner row.
Budget operations then lock the mission row in the same order. This serializes
monthly authorization across an owner's missions and prevents two concurrent
reservations from consuming the same capacity. Totals include committed cost
events and active unexpired reservations; currency is always integer centavos.

A commit below the reservation records the actual charge and implicitly frees
the difference. An above-estimate commit rechecks both ceilings while excluding
its own hold. If the additional amount does not fit, the hold is marked
`RECONCILIATION_REQUIRED`, no committed cost event is written, and an explicit
conflict is returned. Resolving that state is intentionally a future
owner-governed operation.

Release is idempotent for released or expired holds. A committed or
reconciliation-required reservation cannot be silently released. Expired holds
are recovered during later internal reservation operations; owner reads also
project overdue active holds as expired.

## Token rotation and replay controls

Generate tokens with a cryptographically secure secret manager and keep them in
the private account-level PHP configuration. To rotate, install the new token as
current and retain the old token in the previous-token list only for a short,
scheduled overlap. Update callers, verify the new signature, then remove the old
token. Never log tokens or authorization headers. Monitor rejected credentials
and conflicting request IDs without recording secret material. The endpoint
must be reachable only over HTTPS; request IDs provide durable replay handling,
not transport confidentiality.

The ingest request ledger is durable audit/replay state. Establish a retention
policy only after the maximum client retry window and audit requirements are
known; do not delete it as part of routine deployment.

## Rollback and restore

There is no assumed destructive down migration. If application behavior is
wrong, first disable ingest and roll back the PHP artifact while leaving the
additive tables intact. This preserves reservations, cost records, decisions,
and replay protection for investigation.

Do not drop prospecting tables as a routine rollback: foreign keys and audit
history make that destructive and it cannot undo external charges. If schema or
data corruption requires full recovery, stop writes, capture the faulty database
for investigation, create a replacement database, restore the verified
pre-migration backup, validate owner and Studio data, and then repoint the PHP
configuration during a controlled maintenance window. Reapply additive
migrations only after the cause is understood.

Any reservations or provider charges created after the backup require manual
reconciliation before a restore is considered complete. Production migration
and restoration both require an operator-approved change record.
