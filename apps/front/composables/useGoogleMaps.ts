interface GoogleMapsConfig {
  key: string;
  v: string;
}

export function useGoogleMaps() {
  const loadGoogleMapsApi = (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      // Check if API is already loaded
      if (
        typeof window !== 'undefined' &&
        (window as unknown as { google?: { maps?: unknown } }).google?.maps
      ) {
        resolve();
        return;
      }

      const config: GoogleMapsConfig = {
        key:
          (import.meta as { env: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env
            .VITE_GOOGLE_MAPS_API_KEY || '',
        v: 'weekly',
      };

      const cb = '__ib__';
      const libraries: Set<unknown> = new Set();

      const script = document.createElement('script');
      const params = new URLSearchParams();
      params.set('libraries', [...libraries] + '');
      params.set('callback', `google.maps.${cb}`);

      for (const [k, v] of Object.entries(config)) {
        const normalizedKey = k.replace(
          /[A-Z]/g,
          (t: string) => `_${t[0]?.toLowerCase() ?? t}`,
        );
        params.set(normalizedKey, v);
      }

      script.src =
        `https://maps.${'google'}apis.com/maps/api/js?` + params.toString();
      script.onerror = () =>
        reject(new Error('Google Maps JavaScript API could not load.'));

      const nonceScript = document.querySelector(
        'script[nonce]',
      ) as HTMLScriptElement | null;
      if (nonceScript) {
        const nonce = nonceScript.getAttribute('nonce');
        if (nonce) {
          script.setAttribute('nonce', nonce);
        }
      }

      const win = window as unknown as Record<string, unknown>;
      const callbackKey = `google.maps.${cb}`;
      const existingCb = win[callbackKey];
      if (typeof existingCb === 'function') {
        console.warn(
          'Google Maps JavaScript API only loads once. Ignoring:',
          config,
        );
      } else {
        win[callbackKey] = resolve;
      }

      document.head.appendChild(script);

      // Wait for the API to be loaded
      const checkGoogleMapsLoaded = setInterval(() => {
        if (
          typeof window !== 'undefined' &&
          (window as unknown as { google?: { maps?: unknown } }).google?.maps
        ) {
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
    loadGoogleMapsApi,
  };
}
