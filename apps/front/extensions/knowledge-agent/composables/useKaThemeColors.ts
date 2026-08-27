import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

export interface KaThemeColors {
  /** Canvas background */
  bg: string;
  /** Panel background (backlinks sidebar, tooltips) */
  panel: string;
  /** Border / grid line color */
  border: string;
  /** Edge stroke */
  edge: string;
  /** Node fill — isolated (degree 0) */
  isolated: string;
  /** Node fill — linked (degree 1..3) */
  linked: string;
  /** Node fill — hub (degree >= 4) */
  hub: string;
  /** Primary text */
  text: string;
  /** Muted text */
  textMuted: string;
}

/**
 * Read DaisyUI HSL CSS variables (daisyUI 5 emits var(--p), var(--bc) etc as
 * HSL triplets "217 19% 27%"). Returned strings are hsl() values ready for
 * SVG fills and CSS colors.
 *
 * Reactivity: a MutationObserver on <html data-theme> flips `themeKey` so any
 * consumer re-resolves colors. Callers use `themeColors` (computed from the
 * reactive var map) rather than reading getComputedStyle directly.
 */
export function useKaThemeColors() {
  const themeKey = ref(0); // bumped on data-theme change
  const colors = ref<KaThemeColors>(defaultColors());
  let observer: MutationObserver | null = null;

  function hslVar(name: string, fallbackHsl: string): string {
    if (typeof window === 'undefined') return `hsl(${fallbackHsl})`;
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    if (!raw) return `hsl(${fallbackHsl})`;
    // daisyUI 5 emits "217 19% 27%" (hsl triplet) — some versions include
    // the alpha "/0.05"; normalize.
    const cleaned = raw.replace(' /', '/');
    return `hsl(${cleaned})`;
  }

  function resolve(): KaThemeColors {
    return {
      bg: hslVar('--b1', '222 47% 11%'),
      panel: hslVar('--b2', '217 19% 27%'),
      border: hslVar('--bc', '220 13% 69%') + ' / 0.15',
      edge: hslVar('--a', '263 70% 50%'),
      isolated: hslVar('--bc', '220 13% 69%'),
      linked: hslVar('--s', '262 52% 47%'),
      hub: hslVar('--p', '262 83% 58%'),
      text: hslVar('--bc', '220 13% 69%'),
      textMuted: hslVar('--bc', '220 13% 69%') + ' / 0.6',
    };
  }

  function refresh(): void {
    colors.value = resolve();
  }

  onMounted(() => {
    refresh();
    if (typeof window !== 'undefined' && document.documentElement) {
      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.attributeName === 'data-theme') {
            themeKey.value += 1;
            refresh();
          }
        }
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
    }
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
  });

  watch(themeKey, () => refresh());

  function defaultColors(): KaThemeColors {
    // SSR/static defaults — dark DaisyUI palette.
    return {
      bg: 'hsl(222 47% 11%)',
      panel: 'hsl(217 19% 27%)',
      border: 'hsl(220 13% 69% / 0.15)',
      edge: 'hsl(263 70% 50% / 0.6)',
      isolated: 'hsl(220 13% 69%)',
      linked: 'hsl(262 52% 47%)',
      hub: 'hsl(262 83% 58%)',
      text: 'hsl(220 13% 91%)',
      textMuted: 'hsl(220 13% 69% / 0.6)',
    };
  }

  return { colors, themeKey, refresh };
}
