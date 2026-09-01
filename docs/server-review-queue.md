# Server review queue — controlled-test foundation

This extends Studio's existing PHP/MariaDB API. A separate authenticated local
screen now connects to a persistent local MariaDB instance at
[http://127.0.0.1:5182/server-review](http://127.0.0.1:5182/server-review), using
`npm run dev -- --mode review`. It does not replace or import data from the
browser-only IndexedDB review screen. A local-only n8n ingestion path now accepts
the separately designated UID 5 fictional test draft. No production migration,
deployment, sending or sent-folder synchronization was performed. The connection
was verified with a saved generation, without a new email or model request.

See [persistent local setup and test credentials](../ops/review-local/README.md)
for Docker startup, storage boundaries, and the fictional local fixture.

## Implemented boundary

- Existing Studio owner sessions and CSRF tokens protect every write. Owners can
  only list/read/change their own drafts or link their own existing enquiries.
- The queue is disabled unless private server configuration explicitly sets
  `review_queue_enabled` to boolean `true` and supplies `review_test_sender`.
  That address must be the owner's own test sender, never a customer's.
- The original owner-session import route accepts only the existing fictional `CF-AI-TEST-001` email at UID 2 in the hello mailbox
  INBOX is accepted. Exact fictional body text and unsent/unapproved flags are
  required. A browser approval is never carried into server storage.
- Each import requires an explicit enquiry external ID, original email
  Message-ID, UIDVALIDITY, sender and reply address. The enquiry contact must
  match the configured test sender. Subject matching alone is insufficient.
- The importer marks metadata as owner-imported, **not provider-verified**. Do not
  invent a Message-ID or UIDVALIDITY for provider-derived imports to satisfy it.
  The original n8n draft output does not provide the complete required envelope.
  The separate local setup deliberately seeds artificial fixture identities;
  these are not real Hostinger envelope fields or Nemotron output.
- A separate `/local-ingest` route exists only in the local Docker router, not the
  production public API. It uses an import-only Bearer credential and a fixed UID 5
  designation. It explicitly records unavailable UIDVALIDITY as null and deduplicates
  by mailbox + original Message-ID. Reply-To headers are not independently verified;
  the address is the owner's designated test recipient. These limitations are shown
  in the review screen and do not establish send readiness. See the local guide for
  the exact contract and verified saved-execution import.
- The original source and enquiry link cannot be changed through the review API.
  Duplicate source identity or Message-ID cannot overwrite a reviewed record.
- InnoDB transactions and expected versions prevent conflicting edits/decisions.
  An edit invalidates approval but keeps previous text/decisions in server history.
- Approval requires explicit confirmation of both exact saved text and the
  enquiry/email relationship. It snapshots the actor, revision, recipient,
  Message-ID and enquiry. Reads flag changed enquiry contacts; an approval is
  not applicable while the contact no longer matches. This is still not send
  authorization and does not establish that no reply was sent outside Studio.
- No endpoint sends mail, updates mailbox flags, or marks a reply as sent.
  All records return `sendingEnabled: false` and `sentMailSyncEnabled: false`.
- Missing configuration, storage or migrations fail closed. There is no fallback
  to browser approvals. There is no draft-delete endpoint.

## Files and API contract

Apply `database/mysql-review-queue.sql` after the base Studio schema, only to an
explicitly approved target with a backup. It adds one table; it does not replace
existing enquiries. The production API does not auto-run this migration. The
separate local fixture initializer runs both schemas against its dedicated
`review_local` database only.

`public/api/review-queue.php` is included by `index.php` after owner authentication.
`src/lib/serverReviewApi.js` is the same-origin client transport used by
`src/ServerReviewInbox.jsx` in development review mode. The browser-only
`src/ReviewInbox.jsx` remains unconnected and its IndexedDB storage is never read
by the server screen. In review mode the client uses `/review-api/index.php`,
proxied to the separate loopback PHP service.

The PHP API routes use `/api/index.php?action=...` (through the above proxy for
the local server screen):

| Action | Method | Purpose |
| --- | --- | --- |
| `review-drafts` | GET | Owner queue, 50 summaries per page; optional `before` cursor |
| `review-draft` | GET | One record and history, required numeric `id` |
| `review-import` | POST | Store linked fictional draft; duplicate imports preserve decisions |
| `review-change` | POST | `edited`, `approved`, `rejected`, or `reopened` only |

Import JSON object:

```text
inquiryId: existing owner enquiry external ID
draftReply: exact unapproved text, 1–10,000 bytes
model: model label, 1–150 bytes
sentToClient: false
approvalRecorded: false
source:
  mailbox: hello@cinematicflight.com
  folder: INBOX
  uid: 2
  uidValidity: actual positive integer from the mail provider
  messageId: actual original bracketed Message-ID
  from: configured owner test sender
  replyTo: same test sender
  subject: CF-AI-TEST-001
  enquiryText: exact existing fictional test enquiry
```

Change JSON includes `id`, `expectedVersion`, and `action`. Edits need `text`;
approval needs exact saved `text`, `confirmed: true`, and `linkConfirmed: true`;
rejection needs exact saved `text` and a nonblank `note`. Unknown fields cannot
override stored owner/source/history. Requests are limited to 64 KB.

### Optional review attachments

Attachments use the additive migration `database/mysql-review-attachments.sql`.
They remain disabled unless `review_attachments_enabled` is explicitly `true` and
`review_attachment_storage` points to a writable private directory outside
`public_html`. Do not use a public assets or upload directory for these files.

The attachment manifest is immutable for a saved test message. The first nonempty
manifest invalidates an earlier approval because it introduces unreviewed material.
Only JPEG, PNG, WebP, GIF, and UTF-8 text can be stored for preview; each file is
content-checked and limited to 8 MB, with a 40 MB total. Other types stay visible as
metadata only. Owner-authenticated retrieval returns bounded base64 data for the
in-app viewer and never exposes the private storage path. Viewing does not mark a
file reviewed, approve a draft, call AI, or enable sending. This is format checking,
not malware scanning.

## Verification

The persistent local screen has jsdom/mock-client UI coverage, separate from
`node ops/review-local/check.mjs`, which exercises the real Vite proxy, session
sign-in/sign-out, and linked-record reads without changing drafts or decisions.
Neither is browser visual QA. Saved server records persist in
`cinematicflight_review_local_data`; do not delete it or use `down --volumes`.
Unsaved reply text and rejection reasons remain only in tab memory across auth
loss for the same owner and draft, not across reloads or tab closure.

The persistent stack publishes PHP at loopback port 5183 and keeps MariaDB on
an internal network without a published port. PHP also joins a bridge network;
this is not an outbound-network sandbox. It is distinct from the disposable
integration-test stack below.

`ops/review-api-test/compose.yaml` builds a PHP test runtime and a disposable
MariaDB database. It publishes no host ports, uses an internal Docker network,
mounts only source/test/schema directories read-only, and stores database files
in tmpfs. The credentials in that Compose file are fictional and local-test-only.
Never reuse them for Studio. Official runtime images are pinned to the tested
digests and cached by Docker.

Run from the repository (Docker Desktop running):

```sh
docker compose -f ops/review-api-test/compose.yaml up --build --abort-on-container-exit --exit-code-from tests
docker compose -f ops/review-api-test/compose.yaml down
```

On this Mac the executable is also available at
`/Applications/Docker.app/Contents/Resources/bin/docker`.

Tests exercise the real PHP HTTP/session/CSRF layer and MariaDB, not just mocks:
disabled configuration, owner isolation, contact mismatch, missing metadata,
header injection, duplicate source identities, exact-revision approval,
contact changes, history, login persistence, unsupported sending and missing
tables. Two independent PHP processes race against actual InnoDB locks.
They use fictional fixtures only. This is not a production security audit,
provider integration test or browser/UI verification.

On 2026-09-01, all 44 API checks and 45 ingestion/attachment checks passed against
real PHP/MariaDB, along with the 31 review UI checks, 27 n8n workflow checks, four
Sites checks, and both marketing/Sites and Studio builds. The
builds retain the existing large-chunk warning. Temporary test containers were
stopped; the database is disposable and the n8n installation is separate.

## Next implementation and rollout gates

1. The authenticated local server screen is connected and visibly separate from
   the browser-only demo. Complete actual browser visual QA before treating its
   layout and interaction behavior as visually verified.
2. Local import-only n8n credentials are implemented without owner sessions.
   Verify Hostinger UIDVALIDITY and Reply-To/threading semantics before expanding
   beyond the designated local test or treating metadata as send-ready.
3. Obtain explicit approval before applying the additive migration or enabling
   the test queue on private production Studio. Verify with the owner's own
   designated test email only, and keep sending disabled.
4. Add provider-verified threading/recipient checks and sent-folder reconciliation
   before enabling any send button. Handle external replies, duplicate sends,
   ambiguous provider timeouts, and retries without assuming exactly-once delivery.
5. Sending needs a separate confirmation of recipient and exact approved revision.
   This migration and API do not authorize or implement it.
