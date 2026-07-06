declare global {
  interface Window {
    foundation?: {
      track: (type: string, data?: Record<string, any>) => void
    }
  }
}

export {}
