# ChatPPG appearance implementation and review

Status: implemented and verified locally. Not deployed.

## Behavior

New visits use the ChatPPG light appearance, independently of OS appearance.
An explicit Light or Dark choice is saved as `plethscape-appearance`. A small
bootstrap applies it before the application loads. If storage is blocked, the
selector still works for the current session. Appearance is available in the
desktop header, mobile menu, and Learn header.

The theme updates the existing anatomy renderer, optical cutaway, canvases,
and SVG charts. It does not reset the simulation clock, camera, chosen site,
physiology, saved reference, or captured beat. Core simulation, rhythm,
fiducial, locomotion, and surface-fitting logic is unchanged. Thirteen sensitive
math, model, and gesture files are byte-identical to their repository baselines
in both checkouts.

The review also repaired two presentation defects on phones: the captured-beat
controls are no longer hidden by the live-signal collapse rule, and the optical
cutaway gives its title, model, legend, and controls separate layout space.
Tablet lessons also stack the chart above explanatory copy below 1024px,
and lesson-action hover colors retain the correct text contrast in both themes.
These changes preserve the existing simulation and interaction handlers.

## Visual system

- ChatPPG paper `#fdfdfe`, alternate surface `#f5f7fb`, ink `#111318`, muted text
  `#626b7b`, and blue action color `#2855ff`.
- Shared ChatPPG mark, DM Sans font, and a link back to the product family.
- Light-mode chart traces use dark green/red/violet for legibility. Infrared
  is explicitly labeled as violet false color. Numerical optical parameters
  are unchanged.
- Existing dark appearance remains available. Labels, chart grids, tooltips,
  anatomy lighting, scene background, and optical cutaway all follow the choice.

Computed contrast for the main palette is 18.28:1 for ink on paper, 5.05:1
for muted text on panels, and 5.39:1 for blue on paper. Light chart channel
contrasts against paper are 5.17:1 green, 5.38:1 red, and 6.15:1 infrared.
These values cover the named palette pairs, not a blanket accessibility certification.

## Review scope

Both appearances are exercised at 320, 390, 768, and 1440 CSS pixels.
The browser review captures the actual loaded BodyParts3D anatomy, not a mock.

| Surface | States reviewed by the matrix |
| --- | --- |
| Workspace | Onboarding, full anatomy, site controls, running/paused signal |
| Physiology | Sliders, movement, advanced settings, rhythm/condition controls |
| Anatomy | View options, device inspection, optical side on desktop |
| Signal | Reference, wavelength comparison, normalization, penetration science, landmarks, recent beats |
| Movement | Motion and accelerometer charts |
| Captured beat | Whole body, location comparisons, optical cutaway, green/infrared, optical controls |
| Learn | Overview, heartbeat, locations, wavelengths, movement, science |
| Location lesson | Signal, movement, everyday fit, why the wrist |
| Overlays | Mobile menu, mobile physiology drawer, sources, guided experiment steps |

Desktop rails and long dialogs are reviewed through their complete scroll
range. Mobile layouts use their actual document or drawer scroll owner.
The matrix records document and dialog overflow plus uncaught page errors.
Screenshot inventories are under `artifacts/theme-review/<appearance>-<width>/`.

## Verification

- Standalone production build: passed after the final production style changes.
- Unit suite: 63 passed.
- Existing browser regression suite: all 58 checks passed in the final full run.
  Coverage includes real anatomy picking, camera/gesture behavior, physiology,
  references, rhythm, locomotion, captured-beat controls, Learn actions and tours.
- Theme visual matrix: all eight light/dark × viewport cases passed.
- Theme behavior contracts: all eight passed across the full run and focused
  rerun. The full run had 73 passes and one assertion failure caused by exact
  floating-point camera string equality (1.1e-16 difference). The focused
  rerun passed after using a tight 1e-10 camera tolerance; simulation time,
  physiology, reference, focus and renderer identity remain exact checks.
- Final tablet review: both themes passed after restarting the development
  server to clear a stale style transform. A computed-layout assertion and
  refreshed screenshots confirm the chart occupies one column below 1024px.
- Hosted ChatPPG integration: source port, 63 app unit tests, app production
  build, and full Node 24 parent production build passed in the isolated
  `/Users/anton/Projects/chatppg-plethscape-light` worktree. Parent build
  generated 3,605 routes and passed content and metadata validation.
- Native Chrome review of the parent production preview confirmed real
  anatomy, waveform, and light/dark switching. The production-preview matrix
  passed all eight light/dark × viewport cases, with zero uncaught page errors
  or document/dialog horizontal overflow. Final hosted asset verification
  passed 16 checks plus seven HTTP asset/route checks.

The existing host baseline has no reachable guided-tour entry; each hosted
inventory records that unavailable surface explicitly. All five tour steps
and their interactions were reviewed in the standalone app. No new host
behavior was added to expose it as part of this theme change.

Browser viewport emulation does not constitute physical-phone testing. Some
headless optical screenshots intermittently omit overlay text in one capture;
adjacent green/infrared captures show the same overlay correctly. This is a
capture-evidence limitation, not a claimed exhaustive frame-by-frame audit.
The final workspace screenshot uses the real, full-resolution hosted renderer.
Standalone automated screenshots retain the existing reduced rendering
resolution for software/headless browsers; production renderer settings were
not changed to improve screenshots.

Evidence: `artifacts/final-suite-report`, `artifacts/final-targeted-report`,
`artifacts/final-tablet-report`, and `artifacts/host-theme-report`. Inventories
and screenshots: `artifacts/theme-review` and `artifacts/theme-review-host`.

## Source map

- `src/theme.ts`: shared appearance store and chart palettes.
- `src/theme.css`: shared CSS colors, semantic channels, scene grid.
- `src/AppearanceSelect.tsx`, `src/ChatPpgBrand.tsx`, `src/fonts.css`: family
  identity and appearance control.
- `index.html`: first-paint appearance bootstrap.
- Existing component styles: appearance values in their owning rules.
- AnatomyViewer, SensorCutaway, bodyparts, sceneAtmosphere, sensorAuras:
  in-place appearance changes for real 3D scenes.
- Waveform, SignalStudio, RecentBeats, WavelengthComparison, FiducialGuide:
  themed canvas/SVG output and readable annotations.
- `tests/theme.e2e.spec.ts`: appearance contracts and complete screen matrix.

## Local review

```sh
rtk npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
rtk npm run build
rtk npm test
rtk proxy npx playwright test
```

The working preview is at `http://127.0.0.1:5173/` while the dev server runs.
The built parent preview is at `http://127.0.0.1:5174/plethscape`.
