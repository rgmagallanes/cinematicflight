# Cinematic Flight prospect booking workflow

This folder contains an inactive n8n workflow scaffold for the public `/book` experience.

## What it does

1. Receives a signed booking request through a Header Auth webhook.
2. Validates and normalizes the prospect name, email, optional property, purpose, request ID, start/end time, and `Asia/Manila` timezone.
3. Returns `422` for invalid input.
4. Checks the booking calendar for conflicting events.
5. Returns `409` when the time is no longer available.
6. Creates the Google Calendar event and invites the prospect.
7. Sends the prospect confirmation through Brevo.
8. Sends the owner notification through Brevo.
9. Appends an audit row to a Google Sheet.
10. Returns a narrow `201` booking receipt.

The workflow is deliberately inactive. It does not connect the public prototype to production by itself.

## Import

Import [`cinematic-flight-prospect-booking.json`](./cinematic-flight-prospect-booking.json) into n8n. Leave it inactive while configuring and testing.

## Credentials to configure inside n8n

- **Webhook Header Auth:** a long random secret used only by the same-origin server relay and n8n.
- **Google Calendar OAuth2:** access limited to the dedicated Cinematic Flight booking calendar.
- **Brevo HTTP Header Auth:** header name `api-key`; value is the private Brevo API key.
- **Google Sheets OAuth2:** access to the booking audit spreadsheet.

No credential IDs or secrets are included in the exported JSON.

## Replace these placeholders

- `REPLACE_WITH_BOOKING_CALENDAR_ID` in both Google Calendar nodes.
- `REPLACE_WITH_VERIFIED_BREVO_SENDER` in both Brevo request bodies.
- `REPLACE_WITH_OWNER_EMAIL` in the owner notification.
- `REPLACE_WITH_GOOGLE_SHEET_ID` in the Google Sheets node.

Create a sheet tab named `Bookings` with this header row:

```text
request_id,created_at,name,email,property,purpose,start,end,timezone,event_id,event_link,source
```

## Expected request

```json
{
  "requestId": "booking_01JEXAMPLE",
  "name": "Elena Cruz",
  "email": "elena@example.com",
  "property": "The Banyan Estate",
  "purpose": "Photograph reading",
  "start": "2026-09-04T11:00:00+08:00",
  "end": "2026-09-04T11:30:00+08:00",
  "timezone": "Asia/Manila"
}
```

Allowed purpose values are:

- `Photograph reading`
- `New property website`
- `Add the cinematic experience`

## Security boundary

Do not place the n8n webhook URL or Header Auth secret in browser JavaScript. The public `/book` page should submit to a same-origin endpoint. That endpoint validates the request, rate-limits it, creates the request ID, and forwards the signed payload to n8n.

Before activation, add:

- rate limiting and bot protection at the same-origin endpoint;
- idempotency storage keyed by `requestId` so retries cannot create duplicate events;
- a dedicated Studio booking-ingest endpoint if the appointment should also appear in the private sales workspace;
- an error workflow that alerts the owner when the calendar succeeds but an email or audit-row action fails.

## Activation checklist

- Use a dedicated test calendar first.
- Use verified Brevo sender and test recipient addresses.
- Confirm the Google Sheet column mapping after credentials are selected.
- Exercise invalid (`422`), unavailable (`409`), and success (`201`) responses.
- Confirm two simultaneous requests for one slot cannot create two events.
- Confirm the workflow does not expose credentials or private execution data in its response.
- Activate only after the same-origin relay and idempotency store are working.
