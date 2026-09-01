# Persistent local server review

This is a separate, development-only authenticated review screen backed by PHP
and MariaDB on this Mac. A separate manual n8n workflow can now import the designated
UID 5 fictional test draft. It does not read the browser-only inbox's IndexedDB
records. Nothing is sent, and there is no automatic inbox monitoring or sent-mail
synchronization. No production migration or deployment is included.

## Start and sign in

With Docker Desktop running, run from the repository root:

```sh
docker compose -f ops/review-local/compose.yaml up --build -d
npm run dev -- --mode review
```

Open [the local server review](http://127.0.0.1:5182/server-review). Keep the exact
`127.0.0.1` hostname and port: the local API allows this origin.

The fixed fictional **LOCAL ONLY** account is:

- Email: `reviewer@example.test`
- Password: `Local-review-test-only-2026`

These are published test credentials, not real passwords. Do not use a Hostinger
password, reuse these credentials elsewhere, or deploy this directory.

Startup initializes the local schemas and seeds a fictional owner, enquiry, and
sample reply only when missing. The sample is artificial test data, not a real
Hostinger email or Nemotron output. Its Message-ID and UIDVALIDITY are fixture
values, not provider evidence. Existing local drafts and decisions are preserved.
Startup also creates an explicitly fictional enquiry link for the designated
n8n test sender; it does not generate an AI draft. The imported draft remains
distinct from the original sample. Use **Saved test draft** to switch between them.

## Manual n8n import

`router.php` exposes `/local-ingest` only in this local Docker runtime. Production
`public/api/index.php` has no service-ingestion route. The endpoint requires a random
Bearer token stored in the private `cinematicflight_review_local_private` volume;
it is copied into an encrypted n8n credential by `../n8n-local/install-review-bridge.mjs`.
No token belongs in chat, client code, node parameters or Git. The key cannot read
the review queue or edit/approve/reject drafts. Browser origins and cookies are refused.

The server designation fixes UID 5, original Message-ID, sender, owner enquiry,
subject and the approved fictional text, including the deliberately changed opening
and trailing `12`. To designate a different message later, review and update both the
server designation and workflow mapping deliberately; do not relax this into an
inbox-wide allowlist. Incoming JSON cannot choose an owner or another enquiry.

UIDVALIDITY is not available in the observed search output and is stored as `null`,
not fabricated. Identity/deduplication use mailbox plus original Message-ID.
The reply target is the owner's designated test address, not a verified Reply-To
header. The server labels n8n imports as not independently provider-verified.
This is adequate for this local review test, not authorization or readiness to send.

Exact retries return the existing receipt and preserve revisions and decisions.
A different draft/model/source for the same message returns 409, without replacement.
If a save times out, check the inbox before retrying. Retry the same import only;
running the entire model workflow again creates another generation and spends quota.

## Manual attachment preview

The separate inactive n8n workflow `CfReviewAttachments005` checks attachments for
the same designated UID 5 message. It makes no model call, does not send or modify
mail, and cannot approve a draft. It first records the provider's filenames, MIME
types, sizes, and inline flags. It then downloads only JPEG, PNG, WebP, GIF, and
UTF-8 plain-text previews, limited to 8 MB per file, 20 attachments, and 40 MB of
preview files for the message. PDFs, Office documents, archives, HTML, SVG, and
executable content remain listed but are not downloaded or run.

Preview bytes are stored outside the web root in the private
`cinematicflight_review_local_private` volume. The browser receives them only after
owner authentication, through the same-origin review API. Images use object URLs;
plain text is rendered as escaped text. The preview is keyboard navigable, closes
with Escape, restores focus, and does not mark a file reviewed or analyzed. Files
are format-checked but are **not malware-scanned**.

The first nonempty attachment list returns any previously approved draft to Pending,
because it adds material that has not been reviewed. Re-running the identical list
and identical bytes is idempotent. A different list or different bytes fails closed.
The current UID 5 test message initially reported no attachments, so a positive live
preview needs a newly designated harmless test email containing a sample image.

On 2026-08-31 the exact UID 5 draft from n8n execution 44 was imported as record 2,
pending version 1. An identical n8n retry returned `duplicate: true`, with the same
version. No additional model/email request or approval was executed. The older
sample remained record 1, version 6, with an identical pre/post-restart snapshot.

## Storage and network boundaries

Saved records, edits, and decisions persist in the named Docker volume
`cinematicflight_review_local_data`, independently of browser storage and server
restarts. To stop the service while retaining that data:

```sh
docker compose -f ops/review-local/compose.yaml stop
```

Do not delete the volume or use `down --volumes`; doing so would remove the saved
local review data. This persistent stack is distinct from the disposable
`ops/review-api-test` integration-test stack.

MariaDB has no published host port and uses an internal Docker network. PHP is
published only at `127.0.0.1:5183`; the review-mode Vite server proxies
`/review-api/index.php` to it. PHP also joins a bridge network needed for Docker
Desktop port publishing. This is not an outbound-network sandbox.
The n8n container reaches the loopback-published PHP endpoint through
`host.docker.internal:5183`. The ingestion secret has its own persistent volume;
never publish this endpoint or reuse these development credentials in production.

## Review behavior

Sign-in uses server sessions; changes require CSRF protection and server
acknowledgement. Review the original enquiry, exact message identity, recipient,
and saved reply before approving. Save edits before making a decision. Editing
invalidates the current approval; rejection requires a reason. Server history
retains saved revisions and decisions. Approval records a decision only; sending
remains disabled.

Version checks reject stale writes. Refresh and cross-tab notifications can
discover newer saved records; copy any needed unsaved text before explicitly
discarding it and loading the latest version. Connection/configuration errors
hide saved content rather than falling back to browser data.

Unsaved reply text and rejection reasons are retained only in the current tab's
memory across authentication loss, keyed to the same authenticated owner and
draft. Sign back in as that owner without reloading to recover them. Unsaved
work does **not** survive a reload or closing the tab; saved server records do.
The screen blocks voluntary sign-out while unsaved work remains.

## Verification

With both local services running:

```sh
node ops/review-local/check.mjs
```

This real proxy check signs in, reads the linked fixture and its history, checks
that sending and sent-mail sync are disabled, and signs out. It does not edit a
draft or record a decision. Authentication creates/ends a session, so “read-only”
here refers to review records.

The UI's automated jsdom/mock-client tests are separate from this real HTTP
proxy check and from the PHP/MariaDB integration suite documented in
[the server queue guide](../../docs/server-review-queue.md). These checks are not
browser visual QA, a production security audit, or proof of provider integration.
