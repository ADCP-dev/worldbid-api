// GeoJSON loader + ISO2 resolver + centroid extractor.
// Fetches the official globe.gl countries dataset at runtime (same URL as the
// working standalone HTML in dist/index.html).

export const GEO_URL =
  'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson';

// A few ADM0_A3 codes that don't map cleanly to ISO_A2; patch manually.
const ADM0_TO_ISO2: Record<string, string> = { FRA: 'FR', NOR: 'NO' };

export interface CountryFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: unknown;
  __iso2: string;
}

export interface CountriesData {
  type: 'FeatureCollection';
  features: CountryFeature[];
}

export function iso2Of(feat: { properties: Record<string, unknown> }): string | null {
  const p = feat.properties || {};
  const a = (p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : null) as string | null;
  const b = (p.ISO_A2 && p.ISO_A2 !== '-99' ? p.ISO_A2 : null) as string | null;
  const c = (p.ADM0_A2 && /^[A-Z]{2}$/.test(p.ADM0_A2 as string) ? p.ADM0_A2 : null) as string | null;
  const d = ADM0_TO_ISO2[p.ADM0_A3 as string] || null;
  return a || b || c || d || null;
}

export function centroid(feat: { properties: Record<string, unknown>; geometry?: unknown }): { lat: number; lng: number } | null {
  const p = feat.properties || {};
  // Prefer Natural Earth's label anchor when present.
  const lx = p.LABEL_X as unknown;
  const ly = p.LABEL_Y as unknown;
  if (lx != null && ly != null) return { lat: +ly, lng: +lx };
  // Fallback: compute a bounding-box center from the polygon coordinates.
  const c = bboxCenter(feat.geometry);
  if (c) return c;
  return null;
}

// Compute the centroid of the LARGEST polygon in a GeoJSON Polygon/MultiPolygon.
// This avoids the bbox-center problem where MultiPolygon countries with overseas
// territories (e.g. France with French Guiana) get their label in the middle of
// the ocean. We pick the polygon with the most points (best proxy for area at
// this resolution) and compute its bbox center.
function bboxCenter(geometry: unknown): { lat: number; lng: number } | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const g = geometry as { type?: string; coordinates?: unknown };
  // Collect all polygon rings, grouped by polygon (for MultiPolygon).
  const polygons: number[][][][] = [];
  if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
    polygons.push(g.coordinates as number[][][]);
  } else if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
    for (const poly of g.coordinates as number[][][][]) polygons.push(poly);
  } else {
    return null;
  }
  if (polygons.length === 0) return null;
  // Pick the polygon with the most vertices in its outer ring (largest area proxy).
  let best = polygons[0];
  let bestLen = polygons[0][0]?.length || 0;
  for (let i = 1; i < polygons.length; i++) {
    const len = polygons[i][0]?.length || 0;
    if (len > bestLen) { best = polygons[i]; bestLen = len; }
  }
  // Compute bbox center of the largest polygon's outer ring.
  const ring = best[0];
  if (!ring || !ring.length) return null;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

export function countryName(iso2: string, features: CountryFeature[]): string {
  const f = features.find((x) => x.__iso2 === iso2);
  return f ? ((f.properties.ADMIN as string) || iso2) : iso2;
}

import balearesFeature from './baleares.json';

export async function fetchCountries(): Promise<CountryFeature[]> {
  const res = await fetch(GEO_URL);
  if (!res.ok) throw new Error(`GeoJSON fetch failed: ${res.status}`);
  const data = (await res.json()) as CountriesData;
  const out = data.features.filter((d) => {
    const iso2 = iso2Of(d);
    if (!iso2) return false;
    if (iso2 === 'AQ') return false; // Antarctica crashes the three-globe tessellator
    (d as CountryFeature).__iso2 = iso2;
    return true;
  });
  // Add Islas Baleares as a separate entity (not in Natural Earth 110m)
  const ib = balearesFeature as unknown as CountryFeature;
  ib.__iso2 = 'IB';
  out.push(ib);
  return out;
}