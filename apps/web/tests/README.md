# Test environment strategy — WorldBid 3D

## What runs where

| Layer | Runner | Environment | WebGL | Notes |
|-------|--------|-------------|-------|-------|
| Unit (`src/**/__tests__`) | Vitest | jsdom | No | Pure logic: store, seed, altitude, color accessor, Esc handler |
| Integration (`src/**/__tests__`) | Vitest | jsdom | Mocked | Raycaster → store → InspectionCard with fake globe scene |
| E2E (`e2e/`) | Playwright | Chromium + SwiftShader | Yes (software) | Full app, real canvas, real WebGL via software rasterizer |

## Unit + integration (Vitest / jsdom)

`vitest.config.ts` runs under jsdom. jsdom has **no WebGL**, so anything that
touches a WebGL context is mocked:

- `globe.gl` is replaced with a stub `Globe` class via `vi.mock("globe.gl", ...)`.
- `src/globe/GlobeView` is mocked when testing App composition (`vi.mock`).
- The color accessors (`capColorFor`, `sideColorFor`) are unit-tested **without**
  globe.gl — they are pure functions of `(getState, feature)`.

### Raycaster integration without WebGL

`THREE.Raycaster` works in jsdom because it is pure Object3D math (no GL
context). The integration test builds a fake `GlobeInstance` whose `scene()`
returns a `THREE.Scene` with real cap meshes (tagged with `userData.iso2`) and
whose `camera()` returns a `THREE.PerspectiveCamera`. The raycaster is attached
to a real container and driven with synthetic pointer/click events.

Two jsdom gotchas the integration test handles:

1. **No render loop** → `matrixWorld` is never auto-updated. The fixture calls
   `mesh.updateMatrixWorld(true)` and `scene.updateMatrixWorld(true)` so the
   raycaster reads correct world matrices.
2. **`fireEvent.pointerMove` does not reliably populate `clientX`/`clientY`** on
   the dispatched event in jsdom. The test dispatches a native `MouseEvent`
   (`new MouseEvent("pointermove", { clientX, clientY })`) instead — the
   handler only reads `e.clientX`/`e.clientY`, so a MouseEvent satisfies the
   contract and carries the coordinates through.

Hover is rAF-coalesced + 40ms trailing debounce. The test waits ~100ms of real
time for both to flush; the click path is synchronous.

## E2E (Playwright + SwiftShader)

`e2e/` runs against a real headless Chromium with **SwiftShader**, a software
WebGL implementation, so the globe can actually initialize a WebGL2 context in
CI without a GPU. The SwiftShader flags are set in `playwright.config.ts`:

```
use: { args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] }
```

If Playwright browsers cannot be installed in the current sandbox, the E2E
suite is reported as `e2e: config-only` — the config and spec are kept
syntactically valid but not executed.

## Running

```bash
npm test          # vitest run (unit + integration)
npm run typecheck # tsc --noEmit
npm run build     # tsc --noEmit && vite build
npm run e2e       # playwright test (requires `npx playwright install`)
```