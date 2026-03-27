import { authApi } from './authApi'
import type { AppDispatch } from '../app/store'

const EVENT_TO_TAGS: Record<string, string[]> = {
  'basket:updated': ['BasketItems'],
  'order:created': ['ClaimableOrders', 'UserOrders'],
  'claim:status_changed': ['UserClaims'],
  'stripe:onboarded': ['sessionData'],
  'task:completed': ['UserTasks', 'sessionData'],
  'profile:updated': ['sessionData'],
}

export function connectSSE(dispatch: AppDispatch): () => void {
  const url = `${process.env.REACT_APP_AUTH_SERVICE}/events`
  const abortController = new AbortController()

  async function connect() {
    try {
      const response = await fetch(url, {
        credentials: 'include',
        signal: abortController.signal,
        headers: { 'Accept': 'text/event-stream' },
      })

      if (!response.ok || !response.body) return

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              const tags = EVENT_TO_TAGS[data.event]
              if (tags) {
                dispatch(authApi.util.invalidateTags(tags as any))
              }
            } catch { /* ignore malformed events */ }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        // Reconnect after 5 seconds on error
        setTimeout(connect, 5000)
      }
    }
  }

  connect()

  return () => abortController.abort()
}
