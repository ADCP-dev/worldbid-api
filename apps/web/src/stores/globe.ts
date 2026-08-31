// Globe instance store — the vanilla globe script holds the live globe.gl
// instance here so React islands can request camera flights (e.g. SearchBar)
// without importing globe.gl (which would crash the Vite bundler).
//
// We also keep the loaded country features here so islands can resolve
// country names without re-fetching GeoJSON.

import { atom } from 'nanostores';
import type { CountryFeature } from '../lib/geojson';

// Minimal type for the globe.gl instance — we only use a few methods, and we
// never import the real type (it would pull globe.gl into the bundle).
export interface GlobeInstance {
  pointOfView(pov?: { lat: number; lng: number; altitude: number }, ms?: number): { lat: number; lng: number; altitude: number };
  controls(): { addEventListener(ev: string, cb: () => void): void };
  polygonCapColor(fn: (d: unknown) => string): GlobeInstance;
  polygonsData(d: unknown[]): GlobeInstance;
  labelsData(d: unknown[]): GlobeInstance;
  htmlElementsData(d: unknown[]): GlobeInstance;
  onPolygonHover(fn: (d: unknown) => void): GlobeInstance;
  onPolygonClick(fn: (d: unknown) => void): GlobeInstance;
  globeImageUrl(url: string): GlobeInstance;
  backgroundImageUrl(url: string): GlobeInstance;
}

export const globeInstance = atom<GlobeInstance | null>(null);
export const countryFeatures = atom<CountryFeature[]>([]);

// camera fly-to requested by an island (SearchBar). The globe script
// subscribes to this and performs world.pointOfView(...).
export const flyTo = atom<{ lat: number; lng: number; altitude: number } | null>(null);

export function requestFlyTo(lat: number, lng: number, altitude = 1.4): void {
  flyTo.set({ lat, lng, altitude });
}