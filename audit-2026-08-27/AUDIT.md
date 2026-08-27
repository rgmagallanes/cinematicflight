# Property Flight site audit

Date: 2026-08-27

Scope: combined UX, visual, accessibility, performance, and production-readiness review of the local landing page at `http://127.0.0.1:4173/`.

Primary user goal: understand the service, experience its differentiator, gain enough confidence to enquire, and complete the enquiry form.

## Overall verdict

Property Flight is a memorable premium demonstration and already feels more distinctive than a conventional agency landing page. The strongest asset is that the page demonstrates the service instead of merely describing it. It is not ready for paid traffic yet: media weight is high, the offer arrives after a seven-screen cinematic sequence, proof is thin, and the home/back-to-top behavior fails from deep inside the journey.

## Captured flow

1. Desktop entry — strong: immediate, premium, and differentiated.
2. Desktop journey — strong: scroll state and scene naming make the interaction understandable.
3. Desktop offer — mixed: clear one-sentence explanation, but important buying detail is absent.
4. Desktop enquiry — mixed: visually consistent and easy to scan, but reassurance is limited.
5. Empty-form validation — baseline: native validation blocks submission, but recovery is browser-dependent.
6. Mobile entry — strong: the concept survives the narrow viewport without feeling like a reduced desktop page.
7. Mobile journey — strong: scene state remains legible and the media crop is effective.
8. Mobile enquiry — mixed: fields are readable and touch-friendly, but the CTA is below the first contact viewport.

## Highest-impact findings

### P0 — Reduce the initial media payload

- The desktop clips total roughly 44 MB. Because the first two are `preload="auto"`, the opening can ask for about 23 MB of video plus a 3.3 MB fallback image before considering the remaining metadata and page assets.
- The mobile equivalents of the first two clips are about 5.8 MB, again alongside the 3.3 MB fallback image.
- This is likely to damage first visit performance and conversion on mobile data, although a real production-network trace was not available in this local audit.
- Replace the PNG opening image with AVIF/WebP, set video preload conservatively, load the next scene only after intent, and encode multiple lower-bitrate renditions. Measure LCP and total transfer on a production-like connection before launch.

### P1 — Explain the offer before requiring seven screens of attention

- The opening line is emotionally strong but deliberately vague. The plain-language explanation appears after a `700svh` journey.
- Keep the immersive first impression, but add one restrained descriptor in the hero: “Immersive property websites built from your photographs.”
- Give non-participating visitors a visible “See the service” route. The existing skip link is useful for keyboard users but hidden in normal visual browsing.

### P1 — Fix the home/back-to-top destination

- The `#top` target is inside a sticky element. In the captured mobile flow, clicking the Property Flight home link from a later section left the visitor around scene `06 / 07` instead of restoring scene `01 / 07`.
- Move the target to a non-sticky element before the flight shell or use an explicit, tested scroll-to-zero action. Verify the footer “Back to the beginning” link at the same time.

### P1 — Add commercial proof and buying reassurance

- The page shows one attractive example but does not yet answer the questions a serious buyer will have: deliverables, timeline, required source material, hosting/integration, typical engagement size, or what happens after enquiry.
- Add one compact case study with a named property, challenge, delivered experience, and measurable or candid qualitative outcome.
- Add a three-step process and a short qualification block. Avoid a generic feature grid; preserve the editorial visual language.

### P2 — Restore information navigation on mobile

- Mobile hides “Selected work” and “The offer,” leaving only Contact. This keeps the header clean but makes self-guided evaluation harder.
- Add a restrained menu or retain one “The service” link alongside Contact.

### P2 — Improve form recovery and trust

- Required fields and labels are correctly present, and native validation prevents an empty submission.
- The error is a temporary browser tooltip. Add persistent inline error text and associate it with the field using `aria-describedby`.
- Replace the prototype disclaimer before publication with response-time and privacy reassurance, for example: “We reply within two working days. Your details are used only to discuss your property.”

## Accessibility findings

### Confirmed strengths

- One clear H1 followed by logical H2 headings.
- Proper form labels, required attributes, email input type, and autocomplete tokens.
- Visible focus styling is defined, a skip link is present, and a reduced-motion fallback exists in the implementation.
- Touch controls and form inputs are comfortably sized.
- The inspected page produced no console warnings or errors.

### Risks

- Several utility labels are around 9–11 px. Contrast is generally strong, but the text size and wide letter spacing can still make navigation, progress, and form notes difficult to read.
- Scene changes use an `aria-live` region, while the visible “03 / 07” progress is hidden from assistive technology. Announce a concise “Scene 3 of 7: The threshold” only when the scene index changes.
- Native-only form errors are not persistent and may be inconsistently announced.
- The cinematic media is hidden from assistive technology. That is acceptable if decorative, but any information unique to a scene must also appear in text.

## Production and discovery gaps

- The title and meta description are present and descriptive.
- Before launch, add canonical, Open Graph/Twitter metadata, a share image, favicon, structured data appropriate to the business, robots policy, and sitemap.
- Connect the enquiry form to a real endpoint with spam protection, privacy handling, failure state, and analytics events.
- Test actual iOS Safari scroll-video behavior, low-power mode, reduced motion, keyboard-only navigation, screen readers, 200% zoom, and slow mobile data.

## Evidence limits

- This was a local prototype audit, not a production crawl.
- Media sizes were inspected locally; Web Vitals and production cache/range behavior were not measured.
- Screenshots and DOM inspection cannot establish WCAG compliance. Screen-reader behavior, keyboard focus order, zoom reflow, device power modes, and reduced-motion behavior still require dedicated testing.

## Evidence

- `01-desktop-entry.jpg`
- `02-desktop-journey.jpg`
- `03-desktop-offer.jpg`
- `04-desktop-enquiry.jpg`
- `05-desktop-validation.jpg`
- `06-mobile-entry.jpg`
- `07-mobile-journey.jpg`
- `08-mobile-enquiry.jpg`
