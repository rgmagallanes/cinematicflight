# Cinematic Flight design QA

## Comparison target

- Source visual truth: `/Users/richard/Downloads/Codex Image Aug 27, 2026, 10_18_12 AM.png`, specifically the warm-paper “How the experience is created” section.
- Desktop implementation: `/Users/richard/Documents/goodfoodfarm/property-flight-site/qa/visual-explanation-desktop.png`.
- Mobile implementation: `/Users/richard/Documents/goodfoodfarm/property-flight-site/qa/visual-explanation-mobile.png`.
- Normalized source crop: `/Users/richard/Documents/goodfoodfarm/property-flight-site/qa/reference-explanation-crop.png`.
- Full-view comparison evidence: `/Users/richard/Documents/goodfoodfarm/property-flight-site/qa/visual-explanation-comparison.png`.

## Viewports and normalization

- Source image: 864 × 1821 pixels; explanation region cropped from y=905 to 864 × 916 and scaled proportionally to 1132 × 1200.
- Desktop implementation: 1440 × 1200 CSS pixels and 1440 × 1200 screenshot output.
- Mobile implementation: 390 × 844 CSS pixels and 390 × 844 screenshot output.
- State: `#offer`, aligned to the top of the viewport after smooth-scroll completion.
- Density: the source crop and implementation were normalized to the same 1200-pixel comparison height; the side-by-side comparison is 2572 × 1200.

## Required fidelity surfaces

- Fonts and typography: the implementation preserves the source’s high-contrast editorial heading and compact tracked stage labels through the existing Bodoni Moda and Avenir/Futura stacks. The larger heading scale is an intentional continuation of the approved Cinematic Flight system.
- Spacing and layout rhythm: the centered heading, three equal desktop stages, generous warm-paper field, and closing delivery choice follow the source composition. At 390 pixels the stages become a single readable visual sequence with no horizontal overflow.
- Colors and visual tokens: warm mineral paper, botanical ink, and restrained brass markers remain consistent with both the reference and the existing site. The implementation omits decorative texture to preserve the current flat-by-material design rule.
- Image quality and asset fidelity: every visual uses verified Good Food Farm photography already supplied by the project. Stage one presents the photographs as a loose print stack; stage two orders the same material into scenes; stage three places the journey inside a responsive website preview. No placeholder or synthetic property image is used.
- Copy and content: the three source messages are retained: “Your photographs,” “The cinematic flight,” and “Added to your website.” The closing choice clearly distinguishes adding the experience to a current website from building a complete new experience.

## Interaction and browser verification

- “The service” navigation reached the explanation section.
- “Discuss your property” reached `#contact` and aligned the enquiry section to the viewport.
- Desktop and mobile renders had zero horizontal overflow.
- Browser console warnings and errors: none.
- Production build passed and all four Sites worker tests passed.

## Comparison history

### Pass 1

- No actionable P0, P1, or P2 mismatch remained after the first normalized comparison.
- Intentional adaptations: square image and preview geometry instead of the reference’s rounded frames; existing typography and flat material treatment instead of introducing a new visual system; text-only delivery choice instead of approximate device icon drawings.

## Focused comparison

- A separate focused crop was unnecessary because the normalized side-by-side evidence keeps the stage labels, photographs, website preview, and delivery choice readable at the same time.

## Follow-up polish

- P3: real iOS Safari scroll-video behavior remains a publication verification task outside this explanation-section change.
- P3: the prototype enquiry must be connected to an approved endpoint before publication.

final result: passed
