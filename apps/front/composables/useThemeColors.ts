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

  const primary      = read('--color-primary')         || '#7c3aed'
  const secondary    = read('--color-secondary')       || '#a855f7'
  const success      = read('--color-success')         || '#22c55e'
  const error        = read('--color-error')           || '#dc2626'
  const baseContent  = read('--color-base-content')    || '#f5f5f7'
  const base300      = read('--color-base-300')         || '#111118'

  const toHex = (val: string, fallback: string) =>
    val.startsWith('oklch') ? oklchToHex(val, fallback) : (val || fallback)
  const withAlpha = (val: string, alpha: number, fallback: string) =>
    val.startsWith('oklch') ? oklchToRgba(val, alpha, fallback) : (
      val.startsWith('#') ? `${val}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : fallback
    )

  return {
    primary:      toHex(primary, '#7c3aed'),
    primaryAlpha: (a: number) => withAlpha(primary, a, `rgba(124, 58, 237, ${a})`),
    secondary:    toHex(secondary, '#a855f7'),
    success:      toHex(success, '#22c55e'),
    error:        toHex(error, '#dc2626'),
    baseContent:  toHex(baseContent, '#f5f5f7'),
    base300:      toHex(base300, '#111118'),
  }
}