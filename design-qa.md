# Design QA — Appointment Desk and Prospect Booking

## Evidence

- Studio source visual truth: `/Users/richard/.codex/generated_images/01a05b5b-3d74-76f0-a428-1309b60f7466/exec-b4fbe705-afb3-4df4-ae18-0b716364e617.png`
- Prospect source visual truth: `/Users/richard/.codex/generated_images/01a05b5b-3d74-76f0-a428-1309b60f7466/exec-dfd66211-6fd1-452f-900f-0163701a9a9c.png`
- Studio implementation screenshot: `qa/implementation-appointment-desk-viewport-raw.png`
- Prospect implementation screenshot: `qa/implementation-booking-viewport-raw.png`
- Studio combined comparison: `qa/compare-appointment-source-implementation-final.png`
- Prospect combined comparison: `qa/compare-booking-source-implementation-final.png`
- Browser-rendered viewport: 1440 × 1024 CSS pixels.
- Source pixels: 1487 × 1058 for each generated mock. Sources were normalized to 1440 × 1024 for comparison.
- Implementation pixels: 1440 × 1024. No implementation density resampling was needed.
- State: Studio Calendar with The Banyan Estate, cinematic-view purpose, September 24 and 11:00 AM selected; public `/book` with photograph reading, September 4 and 11:00 AM selected.

## Full-view comparison evidence

Both final combined comparisons place the source and rendered implementation in the same 2880 × 1024 artifact. The implementations preserve the source hierarchy, split proportions, forest-night/mineral-paper atmosphere, Bodoni and operational sans-serif roles, hairline separation, calendar density, selected date/time states, and bottom booking summary.

The public implementation intentionally omits the mock's generated botanical line illustration because the project's approved direction prohibits synthetic or illustrated imagery on the public site. The dark field remains intentionally quiet rather than replacing it with an unapproved asset. The Studio implementation retains the real application navigation labels and adds an enquiry selector because appointments must stay linked to existing enquiries.

## Focused region comparison evidence

No separate focused crop was required. At the normalized 1440 × 1024 scale, the prospect identity, purpose controls, calendar cells, time choices, summary copy, Studio enquiry selector, and primary actions remain legible in the combined artifacts.

## Required fidelity surfaces

- Fonts and typography: Passed. Bodoni Moda is limited to editorial headings and calendar emphasis; the existing Avenir/Futura stack carries labels, fields, actions, and operational copy. No clipping or unsafe negative tracking was found.
- Spacing and layout rhythm: Passed. Both screens preserve the source split layout, generous dark-field spacing, hairline grouping, and calendar-to-summary rhythm. The Studio desk now fits within the first 1024px viewport.
- Colors and visual tokens: Passed. Forest night, mineral paper, botanical ink, quiet/signature brass, sage, and cool focus are used consistently without gradients or shadows.
- Image quality and asset fidelity: Passed. The approved transparent brand logo is used directly. No placeholder, CSS-drawn, or generated property imagery was introduced.
- Copy and content: Passed. Prospect and Studio language clearly distinguish a conversation booking from a property guest reservation. The public review explains that availability is checked before creation, and confirmation appears only after the same-origin relay accepts the booking.
- Accessibility and interaction: Passed. Fields have labels, choice groups use radio controls, unavailable calendar days are disabled, selected states remain visible, keyboard focus is explicit, and the main booking path has review and success states.
- Responsive behavior: Passed. At 390 × 844 the public booking route reports 390px document width with zero horizontal overflow; the layout becomes a readable single-column flow.

## Comparison history

### Pass 1 — blocked

- P2: The Studio's ordinary page header added a second editorial layer and pushed the booking action below the initial viewport.
- P2: The public action used a pill and shortened label that drifted from the selected mock.
- P2: The compact public selection footer extended the document by 8px horizontally.

Fixes made: removed the extra Studio page header, moved the date stamp into a compact top row, changed the public action to a square `Review and confirm` control, and aligned the compact footer margins to the 20px mobile gutter.

### Pass 2 — passed

Post-fix evidence shows the Studio desk ending at 988.6px inside the 1024px viewport, the public action matching the selected source anatomy, and the 390px compact document reporting zero horizontal overflow. No actionable P0, P1, or P2 differences remain.

## Findings

No actionable P0, P1, or P2 findings remain.

## Follow-up polish

- P3: A future approved real botanical or property-derived asset could occupy the quiet dark-field space in the public booking screen, but leaving it empty is more truthful than using synthetic decoration.

## Verification

- Primary interactions tested: change/cancel prospect details, choose purpose, choose available day, choose time, open review, submit through the same-origin relay, show the server-confirmed receipt, select a Studio enquiry, and prepare a draft booking.
- Operational integration: a local end-to-end test reached n8n and completed the configured Calendar, Brevo, and Sheets path. Production still requires a public HTTPS n8n endpoint, dynamic availability, and partial-failure hardening.
- Browser console: no errors or warnings during the tested flows.

final result: passed
