/* eslint-disable no-var */
/* eslint-disable @typescript-eslint/no-unused-expressions */
export function useGoogleMaps() {
  const loadGoogleMapsApi = () => {
    return new Promise<void>((resolve, reject) => {
      // Check if API is already loaded
      if (window.google?.maps) {
        resolve();
        return;
      }

      (g => {
        var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary",
          q = "__ib__", m = document, b = window;
        b = b[c] || (b[c] = {});
        var d = b.maps || (b.maps = {}), r = new Set,
          e = new URLSearchParams;
        const u = () => h || (h = new Promise(async (f, n) => {
          await (a = m.createElement("script"));
          e.set("libraries", [...r] + "");
          for (k in g) e.set(k.replace(/[A-Z]/g, t => "_" + t[0].toLowerCase()), g[k]);
          e.set("callback", c + ".maps." + q);
          a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
          d[q] = f;
          a.onerror = () => h = n(Error(p + " could not load."));
          a.nonce = m.querySelector("script[nonce]")?.nonce || "";
          m.head.append(a)
        }));
        d[l] ? console.warn(p + " only loads once. Ignoring:", g) :
          d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n))
      })({
        key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        v: "weekly"
      });

      // Wait for the API to be loaded
      const checkGoogleMapsLoaded = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkGoogleMapsLoaded);
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkGoogleMapsLoaded);
        reject(new Error('Google Maps API failed to load'));
      }, 10000);
    });
  };

  return {
    loadGoogleMapsApi
  };
}
