import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// Vitest config for WorldBid 3D.
// Unit + integration tests run under jsdom. WebGL is NOT available in jsdom,
// so tests that touch the globe layer mock THREE / globe.gl (see tests setup).
// The GLSL vite plugin is intentionally NOT loaded here — unit tests never
// import .glsl files directly (globe modules are mocked where needed).
//
// The geojson plugin inlines .geojson files as `export default <json>` so the
// `import ne110m from "./ne-110m.geojson"` in src/data/geo.ts works under test.
function geojsonInline() {
  return {
    name: "geojson-inline",
    transform(code: string, id: string) {
      if (id.endsWith(".geojson")) {
        const text = readFileSync(id, "utf8");
        return { code: `export default ${text};`, map: null };
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), geojsonInline()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: [
      "src/**/__tests__/**/*.test.ts",
      "src/**/__tests__/**/*.test.tsx",
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
    ],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    css: false,
  },
});