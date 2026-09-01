# Local review inbox

The review inbox is a local, owner-facing extension of Cinematic Flight Studio for reviewing one fictional n8n-generated reply. It is available only through the development-only loopback route `/review-inbox`. The current preview is [http://127.0.0.1:5180/review-inbox](http://127.0.0.1:5180/review-inbox).

This is not a production inbox, email integration, or sending system. Approval records a local decision; it never sends email. There is no automatic inbox checking or production synchronization. No real client material is bundled or preloaded.

A separate [server review queue](server-review-queue.md) now has an authenticated
development screen at
[http://127.0.0.1:5182/server-review](http://127.0.0.1:5182/server-review), started
with `npm run dev -- --mode review` and the
[persistent local Docker setup](../ops/review-local/README.md). It connects to
separate local MariaDB, not Hostinger. The browser-only `/review-inbox` screen
described here remains unconnected; existing browser records and approvals are
unchanged and are not imported automatically.

The server screen uses a seeded artificial sample, not real Hostinger mail or
Nemotron output. Its fixed fictional LOCAL ONLY account is
`reviewer@example.test` / `Local-review-test-only-2026`; do not enter real
passwords. There is no ingestion, sending, or sent-mail sync in that mode either.
Saved server records persist in `cinematicflight_review_local_data`; do not
delete that volume or use `down --volumes`. Unsaved reply text and rejection
reasons can survive authentication loss only in the same open tab for the same
owner and draft; they do not survive reloads. This is distinct from the
browser-only storage behavior described below.

## Import and review

Open the linked local n8n workflow, **One Test Email to Draft**, and manually copy **Review unsent draft → Output → JSON** into the import field. Do not paste API tokens. The importer accepts one JSON object or a one-item array, with an input limit of 50,000 characters.

The designated test identity is exact:

- Subject: `CF-AI-TEST-001`
- Mailbox: `hello@cinematicflight.com`
- Source UID: numeric `2`
- Enquiry: `This is a fictional test enquiry. We already have a property website. Can you add a cinematic experience without rebuilding everything?`
- Flags: `sentToClient: false`, `approvalRecorded: false`, and `aiUsed: true`

A non-empty `draftReply` (up to 10,000 characters) and `model` (up to 150 characters) are required. Matching these fields validates the supported test format, not its authenticity. Real enquiries and pre-approved imports are unsupported.

Repeated imports of the same original reply return the existing record without overwriting edits or decisions. A different generated reply for the same test identity is rejected rather than replacing saved work.

Read the enquiry beside the editable reply, save any changes, and confirm review of the exact saved revision before approving. Rejection requires a reason. Approved or rejected drafts can be returned to review. The interface keeps photo suitability and existing-website compatibility as separate, unassessed checks.

## Revisions, storage, and limits

Every saved text edit increments the revision, returns the draft to **Needs review**, and clears any current approval. Approval is bound to the exact revision and saved text. Reopening also clears the current approval. Earlier import, edit, approval, rejection, and reopening entries remain in history, including their saved text and timestamps.

Records live in browser IndexedDB (`cinematic-flight-review-v1`, object store `drafts`) and are scoped to the browser origin. `localhost` and `127.0.0.1` have separate storage; changing the port also changes the origin. Clearing browser data removes records. Another browser or device does not share them.

Read/write transactions check the expected record version before committing a decision or edit. Competing tab updates are serialized, and stale changes are rejected. BroadcastChannel notifications and window-focus refreshes help tabs discover newer saved versions. Unsaved edits remain visible for copying when a conflict occurs; the interface offers an explicit discard-and-load-latest action.

The history export contains the saved record and its history, not unsaved edits. Keep exported files private. This is local bookkeeping, not authenticated or tamper-proof audit evidence: the import is not independently authenticated, the approval actor is the local label `Local owner`, and browser-controlled records are not production authorization.

## Existing visual direction

The layout extends Studio's reading desk: the reply is dominant, with the draft queue, enquiry, source context, and revision history supporting it. Forest-night framing, mineral-paper reading surfaces, restrained brass accents, and the existing Avenir/Futura sans-serif stack preserve Studio's visual identity.

Operational text uses a locally scoped 16px base and a 16px reply editor rather than inheriting the marketing site's global scale. Supporting metadata and controls use smaller sizes. Muted brass pending, green approved, and clay rejected/error tones are intentional supporting status distinctions; labels also communicate status in text.

The enquiry and reply stack at narrower widths, and the queue moves above the reading surface on compact screens. Existing accessibility provisions include a skip link, visible focus outlines, labelled inputs, polite status announcements, inline alerts, unsaved-edit navigation guards, and reduced-motion styles.

## Implementation and verification boundary

The implementation is in `src/ReviewInbox.jsx`, `src/lib/reviewInbox.js`, and `src/review-inbox.css`. Automated coverage uses `fake-indexeddb` for store behavior and source assertions for integration constraints. These checks do not constitute browser visual QA or verify the running n8n workflow, actual email delivery, or production synchronization.

The separate server screen is implemented in `src/ServerReviewInbox.jsx` and
`src/lib/serverReviewApi.js`. Its jsdom/mock-client UI tests do not replace actual
browser visual QA. `ops/review-local/check.mjs` separately checks real proxy
authentication and read-only draft access without changing review records.
No production migration or deployment is part of this local connection.
