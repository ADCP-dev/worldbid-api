import { converter, clampRgb } from 'culori'

const toRgb = converter('rgb')

function oklchToHex(oklchStr: string, fallback: string): string {
  try {
    const rgb = clampRgb(toRgb(oklchStr))
    if (!rgb || isNaN(rgb.r)) return fallback
    const hex = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0')
    return `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`
  } catch {
    return fallback
  }
}

function oklchToRgba(oklchStr: string, alpha: number, fallback: string): string {
  try {
    const rgb = clampRgb(toRgb(oklchStr))
    if (!rgb || isNaN(rgb.r)) return fallback
    return `rgba(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)}, ${alpha})`
  } catch {
    return fallback
  }
}

export function useThemeColors() {
  const read = (name: string) => {
    if (import.meta.server) return ''
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  }

  const primary      = read('--color-primary')         || '#F97316'
  const secondary    = read('--color-secondary')       || '#262626'
  const success      = read('--color-success')         || '#22C55E'
  const error        = read('--color-error')           || '#EF4444'
  const baseContent  = read('--color-base-content')    || '#F5F5F5'
  const base300      = read('--color-base-300')         || '#262626'

  const toHex = (val: string, fallback: string) =>
    val.startsWith('oklch') ? oklchToHex(val, fallback) : (val || fallback)
  const withAlpha = (val: string, alpha: number, fallback: string) =>
    val.startsWith('oklch') ? oklchToRgba(val, alpha, fallback) : (
      val.startsWith('#') ? `${val}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : fallback
    )

  return {
    primary:      toHex(primary, '#F97316'),
    primaryAlpha: (a: number) => withAlpha(primary, a, `rgba(249, 115, 22, ${a})`),
    secondary:    toHex(secondary, '#262626'),
    success:      toHex(success, '#22C55E'),
    error:        toHex(error, '#EF4444'),
    baseContent:  toHex(baseContent, '#F5F5F5'),
    base300:      toHex(base300, '#262626'),
  }
}