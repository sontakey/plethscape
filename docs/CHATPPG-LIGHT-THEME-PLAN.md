# Plethscape as a ChatPPG product

Planning brief · October 21, 2026 · Implemented and verified locally; not deployed

See [implementation and QA record](CHATPPG-THEME-QA.md) for the current status,
review coverage, preview links, and verification results. The brief below
records the design direction that guided the implementation.

## Outcome

Make the complete Plethscape application open in a light ChatPPG theme by default. Keep the name Plethscape, its interactive anatomy, educational depth, and existing simulation behavior. Present it consistently as **Plethscape by ChatPPG**, with the compact product lockup **ChatPPG. / Plethscape**.

“Light” means visual appearance, not a reduced-feature edition. Retaining an optional dark appearance is the recommended assumption. The first implementation milestone is a working light workspace with real anatomy and waveform rendering, followed by coverage of the remaining screens.

## Evidence and scope

- Live ChatPPG and `/plethscape` were visually inspected in Chrome on October 21. The homepage uses paper surfaces, blue actions and dark text; Plethscape uses a dark immersive stage and amber controls. The hosted app already displays ChatPPG branding.
- The palette and typography below come from the current `chatppg-redesign` source, especially `docs/design/brand.md`, `app/editorial.css`, `app/buttons.css` and `components/Shared/Brand.tsx`.
- The standalone Plethscape checkout has five CSS layers and separate canvas/WebGL colors. Replacing root CSS variables alone will not cover the interface.
- ChatPPG builds a separate copy in `apps/plethscape`. Updating this standalone repository does not automatically update the public app.
- No application code, deployment, simulation parameters, or production settings were changed during this planning pass.

## Visual direction

Use a bright scientific workspace: paper-like surfaces, precise typography, quiet blue emphasis, readable charts and the existing anatomical model. The anatomy remains the dominant visual. Use a neutral pale stage with a very subtle blue wash, a faint floor/contact shadow, and clear outlines for selected sensors. Keep anatomical colors meaningful and realistic.

Use opaque or nearly opaque light control panels so anatomy never competes with text. Avoid turning the workspace into a grid of oversized cards. Preserve the current relationship between location/physiology controls, the body, and the signal panel; adjust spacing only where readability requires it.

| Role | ChatPPG source value | Plethscape use |
| --- | --- | --- |
| Paper | `#fdfdfe` | App base, plain controls, chart backing |
| Alternate paper | `#f5f7fb` | Secondary grouping and subtle stage separation |
| Ink | `#111318` | Headings, values, primary labels |
| Supporting text | `#626b7b` | Units, captions, secondary labels |
| Brand/action blue | `#2855ff` | Primary actions, selected controls, keyboard focus |
| Action hover | `#1942dd` | Hover on primary actions |
| Dividers | `#dce1ea` | Quiet structural separation |
| Figure background | `#f3f6ff` | Optional scientific illustration backing |
| Panel / panel border | `#f6f8fc` / `#ccd6e7` | Selected bounded groups |

Use ChatPPG’s locally hosted **DM Sans**, with 16px controls, 14px secondary labels, and 18px explanatory prose where space supports it. Use tabular numbers for changing measurements and monospace only where technical notation benefits. Keep 4–8px corners, restrained borders, and 44px or larger interaction targets. Do not shrink essential labels to preserve the desktop arrangement on phones.

The existing stationary blue wash belongs in short learning explanations and the stage background sparingly. Keep dense controls and chart plots plain. Additional textures or animated decorative backgrounds are unnecessary.

## Product family

- Use the canonical ChatPPG waveform mark and wordmark, followed by Plethscape in a compact application header.
- Keep workspace navigation local: Workspace, Learn, Replay demo, and appearance. Provide a clear All tools return to `https://chatppg.com/tools` and a ChatPPG home link.
- Keep the current `/plethscape` URL and metadata ownership. Consolidate the existing parent identity rather than adding another stacked header.
- Match the loading state, onboarding, dialogs, menus and footer wording to the same family. “Interactive PPG simulator” is the recommended concise descriptor.
- Preserve Sensor Bio’s existing device-design attribution within the relevant device context; ChatPPG owns the product-level identity.
- Refresh the tools-directory screenshot, homepage tool image and social preview once real light-theme screens exist. Use actual application captures.
- Update the Plethscape product brief’s amber/charcoal requirement and ChatPPG’s documented dark-Plethscape exception to reflect the new approved direction.

## Theme behavior

1. A visitor with no saved preference receives Light, including when their OS is dark.
2. Provide Light, Dark and optionally System in an Appearance control. Persist an explicit choice under a Plethscape-specific preference; do not reinterpret an unrelated parent-site preference.
3. Resolve the choice before the first paint. Keep native control appearance, document `color-scheme` and browser theme color consistent. Invalid or unavailable storage falls back to Light.
4. Theme changes preserve the selected sensor, camera position, physiology, simulation time, captured beat and paused state. Update scene presentation without rebuilding the simulation.
5. Paused and offscreen charts must repaint appropriately when made visible after a theme change; avoid stale dark text or tooltip masks on a light chart.

## Scientific colors

Keep action colors separate from wavelength, anatomy, rhythm and comparison colors. A green-channel trace stays recognizably green; brand blue does not replace all scientific channels. Choose contrast-safe light/dark variants, and retain labels, units and non-color distinctions such as the dashed saved reference.

There is one existing family inconsistency to resolve deliberately: Plethscape represents invisible infrared with warm white, while ChatPPG’s current optics illustration uses violet false color. Recommend adopting a labeled violet IR treatment across Plethscape’s rays, charts, legends and explanatory copy for consistency and light-background contrast. Update `OPTICAL_BANDS` presentation data, accessible descriptions and wavelength documentation together. Do not change optical coefficients or the model’s numerical behavior. Until this coordinated change is made, preserve the existing explanation rather than silently recoloring one chart.

Retain red/blue artery and vein distinctions, tissue hues, fiducial labels, model-source attribution, and the visible educational-simulation qualification.

## Implementation sequence

| Step | Concrete output | Completion check |
| --- | --- | --- |
| 1. Reconcile sources | Compare standalone and hosted `apps/plethscape`, identify current deltas, and establish the porting boundary. Record current screenshots. | Host-only branding and recent functional fixes are accounted for; unrelated local files remain untouched. |
| 2. Establish theme foundations | Semantic UI, chart and scene palettes; DM Sans; first-paint preference behavior; compact ChatPPG product header. | Fresh load is light, explicit preference survives reload, and all native controls follow it. |
| 3. Build the representative workspace | Light location/physiology controls, real 3D anatomy stage, live/single-beat signal and selected sensor. | Real desktop and phone captures show readable anatomy, overlays, controls and traces together. |
| 4. Complete every surface | Learn, lessons, saved-reference comparison, captured-beat studio, wavelength comparison, device inspection, optical cutaway, onboarding, loading, errors and mobile drawers. | No unintentional dark islands, stale canvas colors or unreadable overlays in either appearance. |
| 5. Integrate with ChatPPG | Port the scoped app change into `apps/plethscape`; make the injected tool shell theme-aware; update brand documents and preview assets. | The built `/plethscape` route matches the standalone preview, including reload and assets. |
| 6. Validate and release | Existing checks, targeted theme tests and rendered browser review; production release only as a later execution step. | Verified deployed page, appearance persistence, model loading, navigation and mobile behavior. |

The first visual milestone should include the real body and plot on the same screen. A header or palette preview alone does not validate the light-stage lighting, translucency, sensor visibility or cutaway.

## Implementation map

Standalone root: `/Users/anton/Projects/plethscape`.

- `src/main.tsx`, `src/styles.css`: font loading, theme initialization and semantic tokens.
- `src/experience.css`, `src/instrument.css`, `src/immersive.css`, `src/navigation.css`: replace presentation literals in their owning rules; avoid another permanent override layer.
- `src/App.tsx`, `src/LearnPage.tsx`: product identity, appearance control, loading, navigation and learning surfaces.
- `src/Waveform.tsx`, `src/SignalStudio.tsx`, `src/RecentBeats.tsx`, `src/WavelengthComparison.tsx`, `src/FiducialGuide.tsx`: shared theme-aware chart palette, canvas invalidation, labels and comparison styles.
- `src/AnatomyViewer.tsx`, `src/sceneAtmosphere.ts`, `src/sensorAuras.ts`, `src/assets/scene-grid.svg`: neutral light stage and restrained selection/atmosphere. Anatomy lighting is rewritten during animation, so theme settings must reach that path too.
- `src/SensorCutaway.tsx`: independent opaque renderer, fog and lighting need their own light/dark settings.
- `src/optics.ts`, `docs/WAVELENGTHS.md`: coordinated presentation-only IR mapping if adopting ChatPPG violet.
- `index.html`: first-paint theme metadata, native color scheme and final preview references.

Parent source audited: `/Users/anton/Projects/chatppg-redesign` (recheck its active handoff and branch before implementation).

- `apps/plethscape`: the app source actually built for the website.
- `scripts/build-plethscape.mjs`, `scripts/PLETHSCAPE.md`: build/copy integration and `/plethscape/` asset base.
- `scripts/lib/tool-shell.mjs`, `public/tool-shell.css`: injected parent shell. The current stylesheet forces a dark header with `!important`; this is a required integration fix.
- `app/editorial.css`, `app/buttons.css`, `components/Shared/Brand.tsx`, `docs/design/brand.md`: family identity and component contract.

Use one semantic presentation contract across CSS, canvas and WebGL. Start with a small token module and CSS variables aligned to ChatPPG; a new framework or broad shared-component package is unnecessary for this change.

## Acceptance criteria

- First visits are light with no dark flash; a deliberate dark selection persists. Verify a paused plot, captured beat, open dialog and optical cutaway during theme changes.
- Light stage keeps skin, vessels, organs, wearable hardware and every sensing-site marker distinguishable. Review real renderer output, not only DOM styles.
- Text meets the intended AA contrast targets against actual backgrounds. Verify focus, selected, disabled, hover and tooltip states; avoid color-only explanations.
- Review at 320, 390, 768 and 1440px plus short landscape. No horizontal page overflow, clipped controls, overlapping labels or tiny critical text. Existing 360px minimum width needs attention for the 320px contract.
- Preserve fixed amplitude scale, shared heartbeat timing, comparison semantics, model coefficients, camera gestures, keyboard waveform inspection and learning navigation state.
- Preserve reduced motion, suspended rendering when paused/offscreen, model-loading behavior and usable signal controls when WebGL fails. No extra remote visual assets are needed for the theme.
- Run the repository’s existing production build, unit and browser checks when implementation begins. Update the intentional typography assertion currently expecting Space Grotesk, and add focused coverage for first-paint choice, persistence and paused-chart repaint.
- Validate the parent production build separately from standalone success: direct `/plethscape` reload, fonts/models/decoders under its subpath, return links and actual live screenshots after any release.

## Recommended starting decision

Proceed with one full-featured Plethscape, light by default, a compact ChatPPG product header, the existing anatomy-centered workspace, and a remembered dark option. Complete the representative workspace before spreading the theme to secondary screens. This keeps the first review concrete and exposes the difficult rendering work early.
