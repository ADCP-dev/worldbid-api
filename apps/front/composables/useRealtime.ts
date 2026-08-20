import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@base/auth/stores/auth.store'

export interface RealtimeEvent {
  event: 'insert' | 'update' | 'delete'
  resource: string
  id: number | string
  data?: Record<string, unknown>
  changes?: Record<string, unknown>
}

export function useRealtime(
  channel: string,
  callback: (event: RealtimeEvent) => void,
): void {
  let socket: WebSocket | null = null
  let reconnectAttempts = 0
  let maxBackoffMs = 30000
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false

  const connect = () => {
    const auth = useAuthStore()
    const token = auth.token
    if (!token) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${protocol}//${host}/realtime?token=${encodeURIComponent(token)}`

    socket = new WebSocket(url)

    socket.onopen = () => {
      reconnectAttempts = 0
      socket?.send(JSON.stringify({ event: 'subscribe', data: { channel } }))
    }

    socket.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as { event: string; data: unknown }
        if (parsed.event === 'change') {
          callback(parsed.data as RealtimeEvent)
        }
      } catch {
        // ignore malformed messages
      }
    }

    socket.onclose = () => {
      if (destroyed) return
      const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts), maxBackoffMs)
      reconnectAttempts++
      reconnectTimer = setTimeout(() => {
        if (!destroyed) connect()
      }, backoff)
    }

    socket.onerror = () => {
      socket?.close()
    }
  }

  onMounted(() => {
    connect()
  })

  onUnmounted(() => {
    destroyed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ event: 'unsubscribe', data: { channel } }))
      socket.close()
    }
    socket = null
  })
}