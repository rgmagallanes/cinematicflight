---
name: Cinematic Flight
description: A cinematic property experience that gives real photographs spatial presence before the commercial explanation begins.
colors:
  forest-night: "#07110d"
  forest-night-soft: "#102019"
  forest-close: "#0a1712"
  mineral-paper: "#eee9df"
  mineral-paper-deep: "#ded6c7"
  photographic-white: "#f5f0e5"
  botanical-ink: "#142019"
  quiet-brass: "#c79749"
  brass-ink: "#8b632d"
  warm-brass: "#d6a553"
  brass-light: "#f3c778"
  signature-brass: "#e9b45c"
  caption-brass: "#d0a25b"
  muted-sage: "#aab6ad"
  muted-sage-deep: "#91a096"
  contact-sage: "#bec9bf"
  cool-focus: "#8dd5e4"
typography:
  display:
    fontFamily: '"Bodoni Moda", "Iowan Old Style", Georgia, serif'
    fontSize: "clamp(3.5rem, 7.2vw, 6rem)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "-0.035em"
  display-hero:
    fontFamily: '"Bodoni Moda", "Iowan Old Style", Georgia, serif'
    fontSize: "clamp(4.5rem, 10.5vw, 10.5rem)"
    fontWeight: 400
    lineHeight: 0.82
    letterSpacing: "-0.04em"
  display-hero-service:
    fontFamily: '"Avenir Next", Avenir, Futura, "Century Gothic", sans-serif'
    fontSize: "clamp(3rem, 5.2vw, 4.75rem)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "-0.03em"
  display-hero-service-compact:
    fontFamily: '"Avenir Next", Avenir, Futura, "Century Gothic", sans-serif'
    fontSize: "clamp(1.85rem, 8.2vw, 2.2rem)"
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  body-feature:
    fontFamily: '"Bodoni Moda", "Iowan Old Style", Georgia, serif'
    fontSize: "clamp(1.35rem, 2.3vw, 2.15rem)"
    fontWeight: 400
    lineHeight: 1.35
  utility:
    fontFamily: '"Avenir Next", Avenir, Futura, "Century Gothic", sans-serif'
    fontSize: "0.68rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.18em"
  utility-readable:
    fontFamily: '"Avenir Next", Avenir, Futura, "Century Gothic", sans-serif'
    fontSize: "0.72rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.16em"
  brand-subtitle:
    fontFamily: '"Avenir Next", Avenir, Futura, "Century Gothic", sans-serif'
    fontSize: "0.56rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.1em"
  brand-name-compact:
    fontFamily: '"Avenir Next", Avenir, Futura, "Century Gothic", sans-serif'
    fontSize: "0.64rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.14em"
  brand-subtitle-compact:
    fontFamily: '"Avenir Next", Avenir, Futura, "Century Gothic", sans-serif'
    fontSize: "0.5rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.06em"
  body-small:
    fontFamily: '"Avenir Next", Avenir, Futura, "Century Gothic", sans-serif'
    fontSize: "0.78rem"
    fontWeight: 400
    lineHeight: 1.55
  display-small:
    fontFamily: '"Bodoni Moda", "Iowan Old Style", Georgia, serif'
    fontSize: "1.12rem"
    fontWeight: 400
    lineHeight: 1.3
  service-step:
    fontFamily: '"Bodoni Moda", "Iowan Old Style", Georgia, serif'
    fontSize: "clamp(1.6rem, 2.3vw, 2.3rem)"
    fontWeight: 400
    lineHeight: 1.1
  sequence-number:
    fontFamily: '"Avenir Next", Avenir, Futura, "Century Gothic", sans-serif'
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.12em"
rounded:
  square: "0"
  node: "50%"
  pill: "999px"
spacing:
  gutter: "clamp(1.25rem, 4vw, 4.5rem)"
  section-block: "clamp(7rem, 13vw, 12rem)"
  control-x: "1.35rem"
  control-y: "0.85rem"
components:
  brand-logo:
    asset: "/assets/brand/cinematic-flight-logo-concept-v1.png"
    width: "clamp(10rem, 13vw, 12.5rem)"
    compactWidth: "8.75rem"
    treatment: "Warm-paper and antique-brass transparent horizontal lockup"
    subtitle: "Property websites in motion"
    subtitleTypography: "{typography.brand-subtitle}"
  button-enter:
    backgroundColor: "rgba(4, 11, 8, 0.16)"
    textColor: "{colors.brass-light}"
    typography: "{typography.utility}"
    rounded: "{rounded.node}"
    size: "7.2rem"
  button-solid:
    backgroundColor: "{colors.botanical-ink}"
    textColor: "{colors.mineral-paper}"
    typography: "{typography.utility}"
    rounded: "{rounded.pill}"
    padding: "{spacing.control-y} {spacing.control-x}"
    height: "3.25rem"
  button-paper:
    backgroundColor: "{colors.mineral-paper}"
    textColor: "{colors.botanical-ink}"
    typography: "{typography.utility}"
    rounded: "{rounded.pill}"
    padding: "{spacing.control-y} {spacing.control-x}"
    height: "3.25rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.botanical-ink}"
    typography: "{typography.utility}"
    rounded: "{rounded.pill}"
    padding: "{spacing.control-y} {spacing.control-x}"
    height: "3.25rem"
  input-line:
    backgroundColor: "transparent"
    textColor: "{colors.mineral-paper}"
    rounded: "{rounded.square}"
    padding: "0.8rem 0"
    height: "3.5rem"
---

# Design System: Cinematic Flight

## Overview

**Creative North Star: "The Entered Landscape"**

Cinematic Flight is an editorial property world that behaves like an arrival rather than a conventional agency page. Native-width photography occupies the full viewport first, then yields to motion only as the visitor scrolls. Monumental Bodoni Moda, forest-black exposure, thin brass signals, and quiet utility labels make the interface feel cinematic, architectural, and controlled.

The commercial story arrives on warm mineral paper after the experience has earned attention. Explanatory sections stay restrained and spacious; the dark enquiry close returns the visitor to the opening atmosphere without pretending that the prototype form is a live service.

**Key Characteristics:**

- Full-viewport photographic immersion before explanation.
- Scroll-scrubbed motion that grows out of a sharp still-image anchor.
- Editorial Bodoni Moda paired with a clearer Avenir/Futura service statement and tracked utility text.
- Forest, paper, botanical ink, and rare brass accents.
- Hairline structures, wide breathing room, and deliberately sparse copy.
- A warm-paper and antique-brass threshold-and-path logo anchors the navigation.
- The logo retains “Property websites in motion” as a quiet, centered subtitle below the image lockup.
- A warm-paper commercial handoff followed by a dark, quiet enquiry close.

## Colors

The palette moves between a near-black forest atmosphere and warm mineral paper, with botanical ink carrying text and brass reserved for orientation and invitation.

### Primary

- **Forest Night:** The dominant immersive ground for the flight, proof section, and photographic shading.
- **Mineral Paper:** The warm commercial surface and the light text/control color used against the dark close.

### Secondary

- **Quiet Brass:** A scarce navigation signal for the circular entry control, progress line, frame numbering, and property signature. Brass Ink is its darker accessible companion on mineral-paper process text.
- **Signature Brass / Caption Brass:** Calibrated lighter and quieter brass variants for photographic provenance and proof numbering.

### Neutral

- **Forest Night Soft:** A slightly lifted dark used inside the seven progress nodes.
- **Forest Close:** The enquiry and footer ground, distinct from but adjacent to the flight atmosphere.
- **Mineral Paper Deep:** The method-section surface that creates a subtle tonal step without adding a new hue.
- **Photographic White:** Soft interface copy over imagery; never a harsh pure white.
- **Botanical Ink:** Primary text and filled-action color on paper.
- **Muted Sage / Muted Sage Deep / Contact Sage:** Supporting copy, placeholders, footer information, and the larger enquiry introduction in the dark close.
- **Cool Focus:** A deliberately visible keyboard-focus and input-focus signal.

### Named Rules

**The Brass Is a Signal Rule.** Brass marks entry, orientation, numbering, or provenance; it does not become a broad decorative fill.

**The Two Atmospheres Rule.** Use forest-dark surfaces for experience and enquiry, and mineral-paper surfaces for explanation. Do not muddy either world with generic mid-gray panels.

## Typography

**Display Font:** Bodoni Moda (self-hosted, with Iowan Old Style, Georgia, serif fallbacks)  
**Body Font:** Avenir Next (with Avenir, Futura, Century Gothic, sans-serif fallbacks)  
**Label Font:** The same Avenir/Futura utility stack

**Character:** Bodoni Moda gives the property scale and editorial ceremony, while the sans-serif stack keeps the service statement, instructions, and metadata legible and direct. The contrast is intentional: expressive place-language against disciplined commercial language.

### Hierarchy

- **Hero Service Display** (600, responsive large scale): The opening service statement uses the Avenir/Futura stack in sentence case for immediate clarity. Website and cinematic experience use compact quiet-brass highlight bands with forest-night text, matching the approved local reference.
- **Section Display** (400, responsive large scale, 0.92 line height): Offer, proof, method, and enquiry headlines.
- **Feature Body** (400, responsive medium scale, 1.35 line height): Short explanatory paragraphs and the commercial proposition, set in the display face for warmth.
- **Utility Label** (600–700, compact scale, 0.16–0.22em tracking, uppercase): Navigation, actions, scene status, form labels, captions, and provenance.

### Named Rules

**The Two Voices Rule.** Bodoni Moda expresses the property and editorial atmosphere; the sans-serif stack explains the service and gives instructions and metadata. Keep the main hero service statement in the readable sans-serif voice.

**The Short Measure Rule.** Display statements remain compact and architectural; supporting prose stays near the observed 38rem maximum instead of stretching across the viewport.

## Layout

The flight is a 700svh scroll field containing a sticky 100svh stage. An AVIF-first native-width still image anchors the first viewport; six responsive video clips load progressively, fade in after scroll begins, and are scrubbed across the journey. The stage carries an edge-to-edge image, absolute navigation, a left-led headline, entry control, concise service descriptor, a right-side scene label and vertical rail, a persistent property signature, and a bottom seven-node status line.

Below the flight, sections use the shared responsive gutter and large vertical blocks. The warm-paper offer makes the complete service explicit through three visual stages: the property photographs, the cinematic view produced from them, and the complete website designed around that signature journey. A divided delivery choice makes clear that the cinematic view can join a current website or lead a complete new property website. Proof uses an asymmetrical heading pair and a staggered four-frame run; method uses a three-column statement; enquiry uses a two-column copy/form split. At 900px these structures collapse to one column. At 620px the explanation becomes a vertical story, the opening composition moves toward the bottom, secondary navigation disappears, actions become full width, the form becomes one column, and the rail compresses without being removed.

**The Horizon Stays Clear Rule.** The photographic hero remains full-bleed and uncluttered. Interface elements occupy disciplined edges and corners rather than becoming a central overlay card.

## Elevation & Depth

The system uses no box shadows. Depth comes from photographic exposure, layered edge gradients, sticky scroll movement, tonal surface changes, image staggering, hairlines, and slight state translation. This keeps the world editorial and spatial without introducing floating application-style panels.

**The Flat-by-Material Rule.** Surfaces are separated by image, tone, hairline, or motion—not by generic drop shadows.

## Shapes

The dominant geometry is rectilinear and edge-to-edge: photographs are uncropped by decorative frames, fields are underlined, and sections meet without rounded containers. Perfect circles are reserved for the Enter control and progress nodes. Commercial actions use full pills, creating a compact tactile counterpoint to the otherwise square architecture.

**The Reserved Curve Rule.** Use circles for journey controls and pills for direct actions; do not round sections, photographs, proof frames, or fields.

## Components

### Entry Control

- **Shape:** A large perfect circle, 7.2rem on desktop and 5.8rem on compact screens.
- **Color:** Transparent forest wash with a brass hairline and light brass label.
- **Hover / Focus:** Warms to a solid brass fill and scales slightly; keyboard focus remains the cool, high-contrast outline shared by all controls.
- **Behavior:** Initiates the scroll journey rather than navigating away from the experience.

### Commercial Actions

- **Shape:** Full pills with compact, tracked uppercase labels and a minimum 3.25rem height.
- **Primary:** Botanical ink on mineral paper sections; mineral paper on the dark enquiry close.
- **Secondary:** Transparent with a one-pixel botanical-ink border.
- **Hover / Focus:** Rises by 2px on hover; uses the shared cool focus outline for keyboard navigation.

### Inputs / Fields

- **Style:** Transparent, square fields with only a soft mineral-paper bottom border; labels are tracked uppercase utility text.
- **Focus:** The underline shifts to cool focus while the shared outer focus ring remains visible.
- **Error / Disabled:** Persistent warm-brass error copy sits beneath the affected field, the underline changes state, focus moves to the first problem, and `aria-invalid` / `aria-describedby` connect recovery text to the control.

### Navigation

- **Style:** Transparent over the flight, aligned across the top inside the shared gutter with a soft hairline beneath. Wordmark and links use compact tracked uppercase text.
- **States:** Links reveal an underline on hover and use the shared keyboard focus ring.
- **Responsive:** Compact screens remove Selected Work while retaining the service explanation and Contact so visitors can evaluate or act without losing the photograph.

### Flight Progress

- **Style:** A numeric scene count and a seven-node hairline track fixed to the lower edge of the sticky stage.
- **State:** The brass segment grows with scroll progress while circular nodes remain forest-filled with light outlines.
- **Relationship:** The vertical Scroll rail and persistent Good Food Farm signature complete the orientation system.

### Proof Frames

- **Style:** Four borderless 4:5 photographic frames arranged in a staggered run, with brass numeric captions beneath.
- **Hover:** Saturation returns and the image lifts by half a rem using the system's slow, ease-out motion.
- **Responsive:** The run becomes a two-column composition while preserving the stagger.

### Enquiry Success

- **Style:** A quiet status block separated by a single hairline. The confirmation uses Bodoni Moda; the reset action is a simple underlined text control.
- **Truth:** It demonstrates local interaction only and must not imply a connected production endpoint.

## Do's and Don'ts

### Do:

- **Do** let verified property photography establish the atmosphere before service copy appears.
- **Do** preserve the sharp native-width opening anchor and fade responsive motion in only after scroll begins.
- **Do** keep the seven-node progress, vertical rail, and property signature as one coherent journey-orientation system.
- **Do** use warm paper for commercial clarity and forest-dark surfaces for immersion and the enquiry close.
- **Do** maintain visible keyboard focus, the skip link, the reduced-motion static opening, and responsive behavior down to 320px.
- **Do** keep proof and method sections restrained enough that the property remains the evidence.

### Don't:

- **Don't** replace the opening with a generic agency hero, feature-card grid, or interface panel over the photograph.
- **Don't** use placeholder or synthetic property imagery where verified photographs exist.
- **Don't** overuse brass, pure white, rounded cards, gradients unrelated to photographic legibility, or drop shadows.
- **Don't** autoplay a time-based film in place of visitor-controlled scroll movement.
- **Don't** invent pricing, testimonials, availability, booking actions, performance claims, or production form behavior.
- **Don't** let motion become mandatory; reduced-motion visitors receive the static photographic opening.
