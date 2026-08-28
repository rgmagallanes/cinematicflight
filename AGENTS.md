# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Selected direction

- Build the Cinematic Flight marketing prototype as a hybrid of concept Version 3 and Version 1.
- Keep Version 3's immersive, minimal, full-screen hero and visual identity.
- Follow the hero immediately with Version 1's commercial clarity: what the service is, who it is for, and a clear next action.
- Keep information restrained. The experience should demonstrate the offer; method detail belongs farther down or on a separate page.
- Preserve the existing Good Food Farm project outside this prototype folder.

## Sales dashboard direction

- Name the private application **Cinematic Flight Studio** and use `studio.cinematicflight.com` as its intended production address. Keep it distinct from the public Cinematic Flight marketing website.
- Build the Hostinger Studio artifact with the committed `.env.studio` app mode so the dashboard renders directly at the subdomain root without an HTTP redirect; keep the ordinary production build serving the public marketing experience at `/`.
- Use the selected “Owner’s Daily Flight Deck” image mockup as the source of truth for the private sales dashboard.
- Keep the dashboard separate from the public marketing experience at `/dashboard`.
- Lead with today’s enquiry work, reach and reply health, recent enquiries, and the next best action; keep the document workspace available without letting it compete with the daily sales view.
- Preserve the restrained forest-night, mineral-paper, botanical-ink, and scarce quiet-brass system; use Bodoni Moda only for editorial moments and the existing Avenir/Futura stack for operational UI.
- Keep the initial dashboard explicitly local and owner-facing. Do not imply live email, CRM, cloud storage, or customer-data integrations until they are connected and verified.
- For Property Files, use the approved hybrid direction: lead-linked folders and document navigation from the first concept, the focused editorial reading desk from the second, and the quiet Material received → Reading in progress → Proposal → Sent sequence from the third.
- Keep the property reading editor dominant; directory, enquiry context, source files, version status, and next sales action are supporting rails rather than equal-weight panels.
- Let Property Files import DOCX, text, Markdown, CSV, and Excel files locally and convert their contents into editable working documents. Accept public or published Google Sheets links without implying private Google account access; private sheets require an explicit future OAuth integration.
- Imported documents must open in a focused reading layout rather than a compressed editor: expand content to its full readable height, use at least 16px body text on compact screens, and collapse the property cabinet behind an explicit Property Files control while reading.

## Audit refinement decisions

- Keep the immersive opening, but state the service in plain language within the first viewport and provide a visible route to the commercial explanation.
- Progressively load the flight media; do not prime every clip on first visit.
- Keep proof factual to the working Good Food Farm demonstration until real client outcomes are available.
- Preserve access to the service explanation and contact route on compact screens.
- Use persistent, accessible inline form errors while the enquiry remains an explicitly local prototype.
- Use the post-flight commercial section to explain the service in three parts: the client's photographs, the guided website experience, and the visitor action it connects to.
- Make those three parts visual: a stack of source photographs, an ordered cinematic sequence, and the experience presented inside a property website, followed by the existing-site or complete-rebuild choice.
- Describe Cinematic Flight first as a website design and build service; the cinematic property view is the signature experience created inside that website, not the entire service by itself.
- Lead the hero pitch with “We create websites you can enter” so the business offer is explicit before the cinematic demonstration begins.
- Use “You provide the place. We create the website and the cinematic experience.” as the supporting hero line to distinguish the client's contribution from the service delivered.
- Promote that line to the main hero statement and highlight “website” and “cinematic experience” in restrained light brass; use “Built from real photographs of the property” as supporting copy.
- Use the preferred local-reference treatment: quiet-brass background bands with forest-night text behind “website” and “cinematic experience.”
- Keep the compact hero headline tighter at `clamp(1.85rem, 8.2vw, 2.2rem)` with a 1.06 line height so the mobile composition matches the preferred local version.
- Keep the main hero service statement in sentence-case Avenir/Futura sans-serif for readability; reserve Bodoni Moda for the site's editorial and atmospheric display moments.
- Use the approved transparent Cinematic Flight threshold-and-path logo in the primary navigation; preserve its warm-paper and antique-brass lockup and accessible home-link label.
- Keep “Property websites in motion” as a quiet subtitle directly beneath the navigation logo on desktop and compact layouts.
- State the existing-website-or-complete-rebuild choice once only, in the approved `#offer` delivery choice; the post-proof method section must not restate it.
- Use the post-proof method section to answer the owner's first objection — whether new photography is required — rather than repeating the creation process already covered in `#offer`.
- Keep that answer qualitative and within prototype truth: the property's existing photographs are the material, suitability is assessed before anything is built, and missing views are named rather than commissioned as a production.

## Conversion decisions

- Open the commercial argument by naming the gap before showing the method: the page previously ran solution-first and gave a visitor nothing to recognise themselves in.
- Use `PRODUCT.md`'s own audience insight — owners whose website does not communicate the quality of the place — as the visible problem statement, not just internal positioning.
- Demonstrate the difference with the client's own material rather than a competitor's site: the same Good Food Farm photographs shown as a conventional gallery beside the same photographs given depth and sequence. Never fabricate or screenshot a real property's existing website as a "before".
- Lead the enquiry with the free reading of the client's photographs rather than with a request for their material; the assessment was previously buried as process step 02.
- Keep persuasion in the argument, not in the visual volume. The restrained system is the brand; a louder treatment was tried and rejected.
- Illustrate the problem section with "the flattening": one verified property photograph shown in five steps, each shorter and more drained than the last, ending as an inert strip. It depicts the loss the copy names; the comparison of gallery against flight belongs to the following section and must not be repeated here.
- Do not introduce AI-generated or illustrated imagery anywhere on this site. The offer rests on real photographs of the real place, and synthetic imagery would undercut it.
