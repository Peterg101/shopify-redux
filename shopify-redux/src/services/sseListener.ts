import { authApi } from './authApi'
import { dbApi } from './dbApi'
import type { AppDispatch } from '../app/store'
import { FEATURES } from '../config/featureFlags'

const MANUFACTURING_EVENTS: Record<string, string[]> = {
  'basket:updated': ['BasketItems'],
  'order:created': ['ClaimableOrders', 'UserOrders'],
  'order:claimed': ['UserOrders'],
  'claim:status_changed': ['UserClaims', 'UserOrders'],
  'stripe:onboarded': ['sessionData'],
}

const CORE_EVENTS: Record<string, string[]> = {
  'task:completed': ['UserTasks', 'sessionData'],
  'profile:updated': ['sessionData'],
}

const EVENT_TO_TAGS: Record<string, string[]> = {
  ...CORE_EVENTS,
  ...(FEATURES.MANUFACTURING ? MANUFACTURING_EVENTS : {}),
}

const MESSAGE_EVENTS = new Set(['message:received', 'message:read'])

const RECONNECT_DELAY = 5000
const STALE_THRESHOLD_MS = 30000

export function connectSSE(dispatch: AppDispatch): () => void {
  const url = `${process.env.REACT_APP_API_URL}/events`
  let disposed = false
  let currentAbort: AbortController | null = null
  let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  let lastActivityAt = Date.now()

  const handleVisibility = () => {
    if (document.visibilityState !== 'visible' || disposed) return

    if (reconnectTimeoutId !== null) {
      clearTimeout(reconnectTimeoutId)
      reconnectTimeoutId = null
      connect()
      return
    }

    if (Date.now() - lastActivityAt > STALE_THRESHOLD_MS) {
      currentAbort?.abort()
      connect()
    }
  }

  document.addEventListener('visibilitychange', handleVisibility)

  async function connect() {
    if (disposed) return

    currentAbort = new AbortController()
    const signal = currentAbort.signal
    lastActivityAt = Date.now()

    try {
      const response = await fetch(url, {
        credentials: 'include',
        signal,
        headers: { 'Accept': 'text/event-stream' },
      })

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done || disposed) break

        lastActivityAt = Date.now()
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (MESSAGE_EVENTS.has(data.event)) {
                const claimId = data.data?.claim_id
                const messageTags: any[] = ['Conversations', 'UnreadCount']
                if (claimId) messageTags.push({ type: 'ClaimMessages', id: claimId })
                dispatch(dbApi.util.invalidateTags(messageTags))
              }
              const tags = EVENT_TO_TAGS[data.event]
              if (tags) {
                dispatch(authApi.util.invalidateTags(tags as any))
              }
            } catch { /* ignore malformed events */ }
          }
        }
      }
    } catch (err: any) {
      if (disposed || err?.name === 'AbortError') return
    }

    if (!disposed) {
      reconnectTimeoutId = setTimeout(() => {
        reconnectTimeoutId = null
        connect()
      }, RECONNECT_DELAY)
    }
  }

  connect()

  return () => {
    disposed = true
    if (reconnectTimeoutId !== null) {
      clearTimeout(reconnectTimeoutId)
      reconnectTimeoutId = null
    }
    currentAbort?.abort()
    document.removeEventListener('visibilitychange', handleVisibility)
  }
}
