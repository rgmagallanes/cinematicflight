# Local and live comparison

Compared on 2026-08-27 at the same captured viewport.

## Verdict

The live site is serving the current `/Users/richard/Documents/cinematicflight` build. The local URL on port 4173 is not serving that folder; it is running the older `/Users/richard/Documents/goodfoodfarm/property-flight-site` checkout.

## Step 1: Opening hero

- Local: older amber/brass highlight bands behind `website` and `cinematic experience`.
- Live: approved warm-paper highlight bands with botanical-ink text.
- The remaining hero layout, navigation, logo, copy, image, and progress rail match.

Evidence: `01-local-hero.png`, `02-live-hero.png`.

## Step 2: Scroll-controlled flight

- Both versions use the same `App.jsx` scroll engine and the same six video files.
- Both advanced through the named scenes and updated the progress rail during testing.
- The two captured frames were reached through separate wheel events and are not a frame-perfect timing comparison.
- The local tab selected the phone-weight video source during the test session, while the live tab selected the desktop source. This can make the apparent flight frame differ even when the scene label matches.

Evidence: `03-local-flight.png`, `04-live-flight.png`.

## Root cause

The process listening on port 4173 has this working directory:

`/Users/richard/Documents/goodfoodfarm/property-flight-site`

It is not the moved project at:

`/Users/richard/Documents/cinematicflight`

The two `App.jsx` files match. Their `styles.css` files differ in the hero highlight treatment and compact-screen headline sizing.

## Recommendation

Stop the old port-4173 process and start the local preview from `/Users/richard/Documents/cinematicflight` on the same port. This will make localhost and production use the same source tree.

Screenshot comparison cannot establish full accessibility compliance. Keyboard behavior, reduced-motion behavior, and real-device iOS video seeking remain separate checks.
