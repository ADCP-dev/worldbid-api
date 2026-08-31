// Shared OG metadata fetch — cached, lazy, tri-state.
//
// Single source of truth for microlink previews. Used by Globe.astro
// (claim cards + plane banner), WorldOrder.tsx (row tooltips), and
// CountryCard.tsx (seat tooltips). All three previously kept their own
// local `ogCache` copy — now they share this module so a URL fetched on
// the globe is instantly warm when the same URL is hovered in a panel.

export type OgMeta = { title?: string; description?: string; image?: string } | null;

const ogCache: Record<string, OgMeta> = {};
const ogPending = new Set<string>();

/**
 * Fetch OG metadata for a URL via microlink. Cached forever per URL
 * (both success and failure cache — a null entry means "tried, failed").
 */
export function fetchOgMeta(url: string): Promise<OgMeta> {
  if (!url) return Promise.resolve(null);
  if (ogCache[url] !== undefined) return Promise.resolve(ogCache[url]);
  if (ogPending.has(url)) {
    // Another caller is already fetching — poll until the cache fills.
    return new Promise((resolve) => {
      const poll = () => {
        if (ogCache[url] !== undefined) resolve(ogCache[url]);
        else setTimeout(poll, 250);
      };
      setTimeout(poll, 250);
    });
  }
  ogPending.add(url);
  return fetch('https://api.microlink.io/?url=' + encodeURIComponent(url))
    .then((r) => r.json())
    .then((data) => {
      const meta: OgMeta = {
        title: data?.data?.title,
        description: data?.data?.description,
        image: data?.data?.image?.url || data?.data?.logo?.url,
      };
      ogCache[url] = meta;
      ogPending.delete(url);
      return meta;
    })
    .catch(() => {
      ogCache[url] = null;
      ogPending.delete(url);
      return null;
    });
}

/** Synchronous cache read. `undefined` = not fetched yet, `null` = fetch failed. */
export function getOgMeta(url: string): OgMeta | undefined {
  return ogCache[url];
}

/** True while a fetch for `url` is in flight. */
export function isOgPending(url: string): boolean {
  return ogPending.has(url);
}
