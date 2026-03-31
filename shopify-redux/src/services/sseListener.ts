import { authApi } from './authApi'
import { dbApi } from './dbApi'
import type { AppDispatch } from '../app/store'

const EVENT_TO_TAGS: Record<string, string[]> = {
  'basket:updated': ['BasketItems'],
  'order:created': ['ClaimableOrders', 'UserOrders'],
  'order:claimed': ['UserOrders'],
  'claim:status_changed': ['UserClaims', 'UserOrders'],
  'stripe:onboarded': ['sessionData'],
  'task:completed': ['UserTasks', 'sessionData'],
  'profile:updated': ['sessionData'],
}

const MESSAGE_EVENTS = new Set(['message:received', 'message:read'])

export function connectSSE(dispatch: AppDispatch): () => void {
  const url = `${process.env.REACT_APP_API_URL}/events`
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
      if (err.name !== 'AbortError') {
        // Reconnect after 5 seconds on error
        setTimeout(connect, 5000)
      }
    }
  }

  connect()

  return () => abortController.abort()
}
