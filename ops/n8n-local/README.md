# Local n8n for Cinematic Flight

Local development only. This service is separate from the public website and Studio's production PHP/MariaDB installation.

## Boundaries

- Editor: http://localhost:5678
- Published port is bound to 127.0.0.1 only, not the LAN or public Internet.
- Container: `cinematicflight-n8n`.
- The official image is pinned by digest in `compose.yaml`; upgrades must be explicit, reviewed changes.
- Persistent Docker volume: `cinematicflight_n8n_data`, mounted at `/home/node/.n8n`.
- Time zone: Asia/Manila.
- Diagnostics and personalisation are disabled. This is not an outbound-network sandbox; version checks and explicitly connected services may still use the network.
- Initial setup contains no provider keys, production database credentials, client files or public tunnels. NVIDIA and Hostinger credentials were subsequently added by the owner in n8n, not in this repository. See the workflows below for the tested scope.
- No host folders or Docker socket are mounted inside n8n.

## First use

Create the local owner account in the browser yourself. Keep the password in your password manager; do not put it in this repository or chat. Begin with manual workflows and synthetic test data. A simulated response does not validate real AI quality.

## Lifecycle

Docker Desktop must be running and the Mac must be awake. The service restarts with Docker unless explicitly stopped.

From this directory, use `docker compose up -d` to start and `docker compose stop` to stop without deleting data. On this Mac the Docker executable is also available at `/Applications/Docker.app/Contents/Resources/bin/docker`.

The volume contains the database and n8n credential encryption key. Persistent storage is not a backup. Back it up before upgrades, and never remove the volume or use `docker compose down --volumes` unless intentionally deleting this n8n installation's data.

## Future Studio integration

Keep authentication and owner scoping in Studio's server API. Future n8n access must use dedicated, narrowly scoped service credentials, not your browser login or unrestricted database credentials. A container's `localhost` is not the Mac; use a deliberately configured local bridge when adding a test API. Production Studio cannot call a Mac-only localhost endpoint without an additional connectivity design.

Nothing in this setup enables automatic sending, publishing or production access. The optional Nemotron workflow below makes a hosted model call only after credentials are added and the workflow is manually executed; check your provider account quota and terms first.

The controlled **local** review bridge is now implemented below. Production Studio
integration remains separate and unenabled.

## First workflow: Property Reading DEMO

Source: `workflows/property-reading-demo.json` (ID `CfReadingDemo001`).

The four connected nodes are **Start manually → Sample enquiry → Simulated reading - NO AI → Review draft (stops here)**. The sticky note on the canvas explains how to run it.

- Open the workflow and click **Execute workflow**. Publishing is unnecessary.
- Open the final node and select **Output → JSON** to inspect `draftReading`, `draftReply`, and the safety flags.
- In **Sample enquiry**, change the fictional property name or set `photoCount` to `0` to exercise the missing-material example, then execute again.
- The source marker must remain `synthetic`. Never enter real client data in this demo.
- Photo count is a sample number, not a list of uploaded or inspected images.
- `Awaiting owner review` is an output label only. There is no approval queue or stored approval decision, Studio integration, AI model call, or client message.
- The source JSON has a fixed ID so reimporting targets this demo. Export/back up any edits made in n8n before reimporting; do not overwrite those edits silently.

Run its local checks with `node --test ops/n8n-local/tests/property-reading-demo.test.mjs` from the project root. These checks cover the simulated output, zero-photo branch, invalid data and absence of external-action nodes. They do not test a real model's quality.

## Nemotron reply drafts (credential required)

Source: `workflows/nemotron-reply-drafts.json` (ID `CfNemotronDraft001`). This is separate from the original demo. Do not reimport over browser edits without an export/backup.

Flow: **Start manually → Sample enquiry → Prepare safe request → Nemotron - draft reply → Review draft - stops here**.

1. Open **Nemotron - draft reply**. Authentication is Generic Credential Type → Bearer Auth. Create a credential named `NVIDIA NIM - Cinematic Flight`.
2. Paste your NVIDIA API key into **Bearer Token**, without a `Bearer ` prefix. Set **Allowed HTTP Request Domains** to **Specific Domains**, with `integrate.api.nvidia.com` as the allowed domain. Save it in n8n; never put it in chat, workflow parameters or this repository. No credentials from other projects are reused.
3. Keep the enquiry fictional. A manual run transmits the allowlisted enquiry text, property name, enquiry ID, photo count and drafting instructions to NVIDIA, not to a model running on this Mac. The synthetic marker is a guardrail, not a detector of real personal data.
4. Execute once, then inspect the final node's `draftReply`. Check facts, tone, commitments and next action. No photographs are analysed. There is no automatic sending, Studio connection or persisted approve/reject decision.

Model: `nvidia/nemotron-3.5-lightning-30b-a3b`; endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`. NVIDIA's [official build page](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b/build) lists a free prototype endpoint as of 2026-08-31. Account eligibility, quotas and terms may change; no unlimited/free-production claim is made.

One enquiry and one request per run, 700 output-token cap, no automatic retries, redirect following disabled, 60-second request timeout and 120-second workflow timeout. An error or incomplete response stops the workflow. For 401/403, check the credential/access; for 429, check quota before retrying; do not create retry loops. Model instructions reduce risk but cannot guarantee factual or injection-proof output; owner review is required.

Local execution history can contain prompts and drafts. Keep test data fictional. The source contains no credential ID or API key, and the credential is deliberately left unconfigured for the owner.

Run `node --test ops/n8n-local/tests/*.test.mjs`. These are offline schema/logic tests with mocked model responses, not a live NVIDIA connection or model-quality evaluation.

## Hostinger connection check

Source: `workflows/hostinger-connection-check.json` (ID `CfHostingerCheck001`). Separate manual-only workflow; choose the owner-created `Hostinger Mail - hello@cinematicflight.com` Bearer Auth credential, restricted in n8n to `api.mail.hostinger.com`. Never select the NVIDIA credential for this request.

Only `GET https://api.mail.hostinger.com/api/v1/me` is called. The final node requires exactly one currently visible mailbox matching `hello@cinematicflight.com`. This is a metadata check, not proof of read-only token permissions or exclusion of future mailboxes. Hostinger's token remains broadly privileged for the selected mailbox; verify Selected mailboxes in Hostinger.

Live manual check completed successfully on 2026-08-31. No messages were fetched, sent, changed or passed to NVIDIA. Connecting a designated synthetic email for drafting remains a separate next step. No webhooks or automatic runs are configured.

The local source has no credential ID or token. Do not reimport over saved browser changes without an export/backup. The three additional offline tests check response validation and the fixed GET-only request; all 14 workflow tests passed.

## Designated test email to unsent draft

Source: `workflows/hostinger-test-email-draft.json` (ID `CfHostingerDraftTest001`). This separate manual workflow uses the selected hello mailbox resource ID verified above. No schedules or webhooks are enabled.

- Hostinger's `POST .../folders/INBOX/messages/search` is a search operation, not an email send. The fixed subject is `CF-AI-TEST-001`.
- Exactly one search result with that exact subject, INBOX path and a valid numeric UID is required. Empty, ambiguous or unexpected results stop before fetching message text.
- Only that UID's `GET .../messages/{uid}/text` endpoint is fetched. No attachments, send endpoints, flag updates, moves or deletions are invoked.
- The body must contain the agreed fictional test sentences. Only those sentences are extracted and sent to NVIDIA; addresses, signature text, HTML and metadata are not included in the model request. This deliberately does not yet process arbitrary enquiries.
- The final output is an unapproved, unsent AI draft. Approval storage, sending, Studio integration and inbox-wide automation remain unimplemented. Every manual rerun makes another model call; there is no duplicate-draft prevention yet.
- n8n execution history stores the search result metadata, retrieved test body and draft locally. Treat exports/backups as private. The source JSON contains no credential IDs or tokens; the imported instance reuses the owner's saved Hostinger and NVIDIA credential references. Never replace those credentials with raw keys in node parameters.

All 19 offline tests passed, including exact-match boundaries, body allowlisting, failure cases and the limited network-node graph. These tests do not prove model quality or server-side mailbox flag behaviour.

Live manual test completed on 2026-08-31: exactly one designated email matched, its agreed fictional body text was retrieved, and Nemotron returned an unsent draft (280 reported tokens). No mailbox-write endpoint or send action was invoked. The draft needs owner editing: it conflates photographic suitability with existing-site technical compatibility, and is shorter than the requested 80-150 words. Transport success is not approval of the copy.

## Manual test email → local server review

The owner later designated UID 5 and its edited fictional body in the saved original
workflow. The repository JSON above preserves the earlier single-match demo, not those
browser edits; do not reimport it over the current saved workflow.

`review-bridge.mjs` builds a separate `CfHostingerReviewLocal001` workflow from the
current saved original. `install-review-bridge.mjs` installs it once and refuses to
overwrite an existing bridge. It preserves the original/model nodes and credential
references and adds **Prepare local review import → Save to local review inbox**.
The added credential is restricted to `host.docker.internal` and the server accepts
only the exact designated pending UID 5 import. Full executions still make a model
call; importing a different generation for the same email is deliberately rejected.

The local endpoint, secret, identity limitations, and retry policy are documented in
[the local review guide](../review-local/README.md). No session cookie or owner login
is used as a service credential. Nothing writes to production Studio or sends email.

`replay-saved-draft.mjs <private-envelope.json>` imports an **already-generated**
draft with a separate two-node `CfLocalReviewSaved005` workflow (manual trigger and
local HTTP save only). Its existing body must be inspected before reuse; it is not
a workflow that reads new mail or calls AI. Used with the exact execution-44 output
on 2026-08-31, then retried to verify the duplicate receipt. No additional AI call.
Private replay input is ignored under `runtime/`; n8n execution/credential storage
and private Docker volumes remain local sensitive data, not backups.

Verification for this increment: 51 JavaScript checks; 44 existing PHP/MariaDB
checks plus 21 ingestion checks; both marketing/Sites and Studio builds. Actual
n8n-to-local-HTTP import and duplicate retry passed. Browser visual QA was not run.
The original imported reply still needs owner editing: photograph suitability alone
does not establish technical compatibility with an existing website.
