# Cinematic Flight Property Files design QA

## Comparison target

- Source visual truth: `/Users/richard/Documents/cinematicflight/qa/design-reference-property-files-hybrid.png`.
- Normalized source: `/Users/richard/Documents/cinematicflight/qa/design-reference-property-files-hybrid-1440x1024.png`.
- Final browser-rendered implementation: `/Users/richard/Documents/cinematicflight/qa/implementation-property-files-final.png`.
- Final side-by-side evidence: `/Users/richard/Documents/cinematicflight/qa/design-qa-property-files-final.png`.

## Viewport and normalization

- Source image: 1487 × 1058 pixels, normalized to 1440 × 1024 for direct comparison.
- Implementation: 1440 × 1024 CSS pixels at device density 1.
- Side-by-side comparison: 2880 × 1024 pixels.
- State: Property Files, The Banyan Estate, Property reading, Draft version 1.

## Required fidelity surfaces

- Layout: the implementation preserves the selected four-part anatomy: forest-night primary navigation, lead-linked property cabinet, dominant editorial reading desk, and a supporting sales-context rail.
- Hierarchy: the property name and document journey sit above a quiet formatting bar; the reading title and three editable sections remain the primary work surface; sales actions are restrained at the bottom.
- Typography: Bodoni Moda carries property and document titles while the existing Avenir/Futura stack carries operational labels, controls, file metadata, and status copy.
- Tokens: mineral paper, botanical ink, muted sage, forest night, scarce quiet brass, and hairline separators match the approved dashboard system.
- Assets: the approved transparent Cinematic Flight logo is reused directly. The selected screen requires no property photography, so no synthetic imagery or placeholder raster assets were introduced. Interface symbols use Phosphor Icons.
- Content: source-material filenames remain references to local property files; the prototype does not imply cloud storage, CRM synchronization, live email, or a production document backend.

## Functional verification

- Switching from The Banyan Estate to Riverstone Lodge updates the property, source material, document set, progress, and sales context.
- “Back to all files” opens the cross-property library and returns to the active reading.
- Editing document content updates the local working copy; the test content was restored.
- “Save version” advanced the test-origin document to version 2 and showed a local-save status.
- “Mark reading ready” updated the test-origin reading to Ready.
- “View enquiry” opened and closed the linked enquiry panel.
- “View in pipeline” navigated to the pipeline view.
- A fresh interaction-test tab reported no console warnings or errors.
- The final 1440 × 1024 view has no horizontal or vertical page overflow.

## Comparison history

### Pass 1

- Evidence: `/Users/richard/Documents/cinematicflight/qa/design-qa-property-files-pass-1.png`.
- [P2] The reading content ended too early, leaving the action row materially higher than the reference. Fixed by restoring the source’s deliberate lower-page whitespace and anchoring the actions at the viewport bottom.
- [P2] The action footer inherited the public site’s dark footer treatment. Fixed with an explicit mineral-paper workspace footer and brass primary action.
- [P2] The document-journey header was approximately 50 pixels shallower than the selected mockup. Fixed by matching its vertical breathing room while preserving the progress position.

### Final pass

- Evidence: `/Users/richard/Documents/cinematicflight/qa/design-qa-property-files-final.png`.
- The normalized comparison shows matching major-region proportions, header depth, reading-title position, section sequence, lower-page whitespace, action placement, and contextual-rail density.
- No actionable P0, P1, or P2 difference remains.

## Build verification

- `npm run build`: passed; generated `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
- `npm run test:sites`: passed, 4 tests and 0 failures.
- `git diff --check`: passed.

## Follow-up polish

- P3: the local prototype stores document edits and versions in browser local storage. Shared folders, authentication, permissions, file upload, and durable server-side revision history remain future integrations.
- P3: compact breakpoint rules are implemented for a stacked cabinet, editor, and context rail; the approved mockup and current fidelity gate are desktop-first.

## Import workflow extension

- Final compact-browser evidence: `/Users/richard/Documents/cinematicflight/qa/implementation-property-import-final.png` at 745 × 791 CSS pixels.
- The compact importer has no horizontal overflow (`innerWidth: 745`, `scrollWidth: 745`) and collapses the folder tree while importing so the file controls remain immediately reachable.
- A TXT file was imported through the browser file chooser, converted into an editable document, persisted under the selected property, and verified with its complete text intact.
- Invalid Google Sheets links produce a persistent, actionable inline error. Public/published Google Sheets links are supported; private account access is explicitly not implied.
- Word and spreadsheet parsers are loaded only after the relevant import action, keeping the initial dashboard bundle near its previous size.
- The Impeccable detector reported advisory design-token drift across the existing dashboard stylesheet but no new blocking interface anti-pattern.

## Imported-document reading refinement

- Compact reading evidence: `/Users/richard/Documents/cinematicflight/qa/implementation-imported-reading-compact.png` at 745 pixels wide.
- Imported document text now renders at 16px with a 28.48px line height in the compact browser and expands to the document’s complete scroll height instead of clipping inside a fixed textarea.
- The property cabinet collapses while reading and returns through a 44-pixel Property Files control; opening the cabinet and selecting the document again were browser-tested.
- The compact reader reported `scrollWidth: 745` at `innerWidth: 745`, with no console warnings or errors.

final result: passed
