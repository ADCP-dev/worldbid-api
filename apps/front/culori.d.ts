declare module 'culori' {
  export function converter(mode: string): (color: string) => {
    r: number
    g: number
    b: number
    mode: string
  } | undefined

  export function clampRgb(color: { r: number; g: number; b: number; mode?: string }): {
    r: number
    g: number
    b: number
    mode: string
  }
}