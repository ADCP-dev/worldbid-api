# WorldBid 3D

Interactive WebGL2 globe with all **195 sovereign countries** extruded as
selectable polygons, a HUD overlay (top bar + inspection card), and static
sovereignty data (owner, price, color, message) seeded at load — no network
calls. This is the MVP slice `globe-render-selection-static-sovereignty`.

## Quick path

```bash
npm install      # install dependencies
npm run dev      # start Vite dev server at http://localhost:5173
npm test          # run unit + integration tests (Vitest, jsdom)
npm run typecheck # tsc --noEmit
npm run build     # tsc --noEmit && vite build → dist/
npm run e2e       # Playwright E2E (Chromium + SwiftShader; see below)
```

Open the app, hover a country to highlight it, click to select it (the
InspectionCard appears bottom-right with owner, price, and color swatch),
press **Escape** to deselect.

## What this slice contains

| Area | What | Files |
|------|------|-------|
| Store | Zustand store: 195-country sovereignty state + single selection/hover | `src/store/countriesStore.ts` |
| Seed | Deterministic 195-entry seed (owner, currentPrice, color, message) | `src/data/seed-countries.ts`, `src/data/sovereign-iso2.ts` |
| Globe | globe.gl WebGL2 render layer, KTX2 day/night textures, Fresnel atmosphere shell, raycaster | `src/globe/{createGlobe,GlobeView,raycaster,altitude,atmosphereShell,textures}.ts` |
| Geo | ne_110m country polygons with ISO2 resolution | `src/data/geo.ts`, `src/data/ne-110m.geojson` |
| HUD | TopBar (title + visual balance), SearchInput (visual only), InspectionCard | `src/App.tsx`, `src/hud/*.tsx` |
| Tests | Unit (store, seed, altitude, color accessor, Esc), integration (raycaster→store→card), E2E (Playwright/SwiftShader) | `src/**/__tests__/`, `tests/`, `e2e/` |

## Details

| Topic | Decision |
|-------|----------|
| Rendering | globe.gl on WebGL2 (asserted at init, R-GLOBE-01). No WebGPU path. |
| Textures | KTX2 (Basis Universal, ETC1S) for day + night sides, decoded at runtime via `public/basistranscoder/`. No PNG fallback. |
| Selection | Raycaster against polygon cap meshes; hover is rAF-coalesced + 40ms trailing debounce; single selection (clicking a new country replaces the old); empty-space click deselects. |
| Sovereignty | 195 = 193 UN members + 2 observers (VA, PS). Seeded synchronously from a bundled record — no network (R-SOV-02). |
| Color | Per-country hex derived from a stable FNV-1a hash of the ISO2. Selected → orange tint, hovered → yellow tint, default → store color. |
| HUD overlay | `pointer-events: none` on the overlay wrapper; each HUD child re-enables `pointer-events: auto` so the globe still receives events under empty areas. |
| Test env | Unit + integration under jsdom (no WebGL; globe.gl mocked). E2E under Chromium + SwiftShader (software WebGL). See `tests/README.md`. |

## SwiftShader test flag

E2E tests run headless Chromium with SwiftShader — a software WebGL
implementation — so the globe can initialize a real WebGL2 context in CI
without a GPU. The flags are set in `playwright.config.ts`:

```
use: { args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] }
```

If Playwright browsers cannot be installed in your environment, the E2E suite
is reported as `e2e: config-only` — the config and spec remain syntactically
valid (`npx playwright test --list` lists the test) but are not executed.

## Asset attribution

| Asset | Source | License |
|-------|--------|---------|
| `public/tex/day.ktx2`, `public/tex/night.ktx2` | Encoded from NASA Blue Marble imagery (Earth surface day + night sides). | NASA imagery is public domain. KTX2 encoding via [`toktx`](https://github.com/KhronosGroup/KTX-Software) / [Basis Universal](https://github.com/BinomialLLC/basis_universal) (transcoder under Apache-2.0). |
| `public/basistranscoder/` | Basis Universal transcoder (JS + WASM) | Apache-2.0 — see [Basis Universal](https://github.com/BinomialLLC/basis_universal) |
| `src/data/ne-110m.geojson` | [Natural Earth](https://www.naturalearthdata.com/) `ne_110m_admin_0_countries` (1:110m cultural vectors) | Public domain — Natural Earth is in the public domain. |
| `src/data/sovereign-iso2.ts` | ISO 3166-1 alpha-2 codes for 193 UN members + 2 UN observer states (VA, PS) | ISO 3166 is an ISO standard; the country list is factual. |

## Next step

This is the MVP slice. Future work (out of scope here): bid engine, search
filtering, real balance, network-backed sovereignty state. See the SDD change
`globe-render-selection-static-sovereignty` for the spec and design.