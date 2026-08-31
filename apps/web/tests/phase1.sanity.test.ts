// Sanity smoke test for the active Astro src/ layout.
//
// Previously this file imported from ../src/data/seed-countries and
// ../src/globe/altitude, which only existed in the pre-Astro src.old-vite/
// checkout and were never ported. Those paths are stale under the active
// Astro + React islands layout, so the assertions that depended on them have
// been deleted. What remains is a tiny guard that the modules we DO have
// (geojson + heatmap) load under vitest/jsdom and expose their documented
// surface — this protects Phase 1 wiring before the full unit suite lands.
import { describe, it, expect } from "vitest";
import { iso2Of, countryName } from "../src/lib/geojson";
import { heatColor, heatTierName, HEAT, MIN_STAKE } from "../src/lib/heatmap";

describe("phase1 sanity (active src/ layout)", () => {
  it("heatmap exposes the five-tier palette + helpers", () => {
    expect(HEAT.UNCLAIMED).toMatch(/^#[0-9a-f]{6}$/i);
    expect(HEAT.LOW).toMatch(/^#[0-9a-f]{6}$/i);
    expect(typeof MIN_STAKE).toBe("number");
    expect(typeof heatColor(0)).toBe("string");
    expect(typeof heatTierName(0)).toBe("string");
  });

  it("iso2Of resolves a feature with ISO_A2_EH", () => {
    const feat = {
      properties: { ISO_A2_EH: "FR", ADM0_A3: "FRA", ADMIN: "France" },
    } as unknown as Parameters<typeof iso2Of>[0];
    expect(iso2Of(feat)).toBe("FR");
  });

  it("countryName falls back to iso2 when feature is missing", () => {
    expect(countryName("ZZ", [])).toBe("ZZ");
  });
});