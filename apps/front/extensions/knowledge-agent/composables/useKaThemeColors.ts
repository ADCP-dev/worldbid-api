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
 * Read DaisyUI 5 CSS custom properties (--color-primary, --color-base-100,
 * etc.) which use oklch values like "oklch(0.65 0.2 40)".
 *
 * Reactivity: a MutationObserver on <html data-theme> bumps `themeKey` so
 * consumers re-resolve colors when the active theme changes.
 */
export function useKaThemeColors() {
  const themeKey = ref(0);
  const colors = ref<KaThemeColors>(defaultColors());
  let observer: MutationObserver | null = null;

  function cssVar(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    if (!raw) return fallback;
    return raw;
  }

  function resolve(): KaThemeColors {
    const primary = cssVar('--color-primary', '#F97316');
    const base100 = cssVar('--color-base-100', '#161616');
    const base200 = cssVar('--color-base-200', '#1e1e1e');
    const base300 = cssVar('--color-base-300', '#262626');
    const baseContent = cssVar('--color-base-content', '#F5F5F5');
    const neutral = cssVar('--color-neutral', '#161616');

    return {
      bg: base100,
      panel: base200,
      border: base300,
      edge: primary,
      isolated: neutral,
      linked: primary,
      hub: primary,
      text: baseContent,
      textMuted: `${baseContent}99`,
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
    return {
      bg: '#161616',
      panel: '#1e1e1e',
      border: '#262626',
      edge: '#F97316',
      isolated: '#737373',
      linked: '#F97316',
      hub: '#F97316',
      text: '#F5F5F5',
      textMuted: '#F5F5F599',
    };
  }

  return { colors, themeKey, refresh };
}