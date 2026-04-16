import { AppState, AppStateStatus } from 'react-native';
import { getToken } from './auth';
import { GENERATION_URL, MEDIA_URL } from './config';
import type { AppDispatch } from '../store';
import {
  setCadLoadedPercentage,
  setCadLoading,
  setCadPending,
  setCadStatusMessage,
  setCadError,
  setCadOperationType,
  setCadCompleted,
} from '../store/cadSlice';

const RECONNECT_DELAY = 3000;
const STALE_THRESHOLD_MS = 30000;

export function connectProgressStream(
  portId: string,
  dispatch: AppDispatch,
): () => void {
  let disposed = false;
  let taskTerminated = false;
  let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let currentAbort: AbortController | null = null;
  let lastActivityAt = Date.now();
  let isFirstMessage = true;
  let appStateSubscription: { remove: () => void } | null = null;

  const cleanup = () => {
    disposed = true;
    if (reconnectTimeoutId !== null) {
      clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }
    currentAbort?.abort();
    appStateSubscription?.remove();
  };

  const handleAppState = (nextState: AppStateStatus) => {
    if (nextState !== 'active') return;
    if (disposed || taskTerminated) return;

    if (reconnectTimeoutId !== null) {
      clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
      isFirstMessage = true;
      connect();
      return;
    }

    if (Date.now() - lastActivityAt > STALE_THRESHOLD_MS) {
      currentAbort?.abort();
      isFirstMessage = true;
      connect();
    }
  };

  appStateSubscription = AppState.addEventListener('change', handleAppState);

  const connect = async () => {
    if (disposed || taskTerminated) return;

    currentAbort = new AbortController();
    const signal = currentAbort.signal;
    lastActivityAt = Date.now();

    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(
        `${GENERATION_URL}/progress/${portId}`,
        { signal, headers },
      );

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done || disposed) break;

        lastActivityAt = Date.now();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data) continue;

          if (isFirstMessage) {
            isFirstMessage = false;
          }

          await handleMessage(data, dispatch, signal);

          if (data.startsWith('Task Completed') || data.startsWith('Task Failed')) {
            taskTerminated = true;
            appStateSubscription?.remove();
          }
        }
      }
    } catch (err: any) {
      if (disposed || err?.name === 'AbortError') return;
    }

    if (!disposed && !taskTerminated) {
      dispatch(setCadLoading({ cadLoading: false }));

      reconnectTimeoutId = setTimeout(() => {
        reconnectTimeoutId = null;
        isFirstMessage = true;
        connect();
      }, RECONNECT_DELAY);
    }
  };

  connect();
  return cleanup;
}

async function handleMessage(
  data: string,
  dispatch: AppDispatch,
  signal: AbortSignal,
) {
  if (data.startsWith('Task Failed')) {
    const errorMsg = data.replace('Task Failed,', '');
    dispatch(setCadError({ cadError: errorMsg }));
    dispatch(setCadLoading({ cadLoading: false }));
    dispatch(setCadPending({ cadPending: false }));
    dispatch(setCadOperationType({ cadOperationType: null }));
    return;
  }

  if (data.startsWith('Refinement Rejected,')) {
    const reason = data.substring('Refinement Rejected,'.length);
    dispatch(setCadError({ cadError: `Refinement rejected: ${reason}` }));
    dispatch(setCadLoading({ cadLoading: false }));
    dispatch(setCadPending({ cadPending: false }));
    dispatch(setCadOperationType({ cadOperationType: null }));
    return;
  }

  if (data.startsWith('Clarification Needed,')) {
    const clarification = data.substring('Clarification Needed,'.length);
    dispatch(setCadError({ cadError: null }));
    dispatch(setCadLoading({ cadLoading: false }));
    dispatch(setCadPending({ cadPending: false }));
    dispatch(setCadOperationType({ cadOperationType: null }));
    dispatch(setCadStatusMessage({ cadStatusMessage: clarification }));
    return;
  }

  if (data.startsWith('Task Completed')) {
    const parts = data.split(',');
    const cadTaskId = parts[1];
    const fileName = parts[2] || 'generated';
    const jobId = parts[3];

    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const previewResp = await fetch(
        `${MEDIA_URL}/step/${jobId}/preview_url`,
        { signal, headers },
      );
      if (previewResp.ok) {
        const { url: presignedUrl } = await previewResp.json();
        if (presignedUrl) {
          dispatch(setCadCompleted({
            taskId: cadTaskId,
            glbUrl: presignedUrl,
            fileName,
          }));
        }
      }
    } catch {
      // Non-fatal — model just won't have 3D preview
    }

    dispatch(setCadLoading({ cadLoading: false }));
    dispatch(setCadPending({ cadPending: false }));
    dispatch(setCadOperationType({ cadOperationType: null }));
    return;
  }

  // Progress update: "percentage,statusMessage"
  const parts = data.split(',');
  if (parts.length >= 2) {
    const percentage = parseInt(parts[0], 10);
    const statusMessage = parts[1];

    if (!isNaN(percentage)) {
      dispatch(setCadLoadedPercentage({ cadLoadedPercentage: percentage }));
      dispatch(setCadStatusMessage({ cadStatusMessage: statusMessage }));
      dispatch(setCadLoading({ cadLoading: true }));
    }
  }
}
