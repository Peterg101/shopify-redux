import { AppDispatch } from "../app/store";
import { authApi } from "./authApi";
import { MeshyTaskStatusResponse } from "../app/utility/interfaces";
import logger from '../app/utility/logger';
import { setMeshyLoadedPercentage, setMeshyLoading, setMeshyPending, setMeshyQueueItems, setMeshyPreviewTaskId } from "./meshySlice";
import { extractFileInfo, fetchFile } from "./fetchFileUtils";
import { setFileProperties, setFromMeshyOrHistory } from "./dataSlice";

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;

export const createWebsocketConnection = (
  portId: string,
  dispatch: AppDispatch,
  setActualFile: React.Dispatch<React.SetStateAction<File | null>>
): { ws: WebSocket; cleanup: () => void } => {
  let reconnectAttempts = 0;
  let ws: WebSocket;
  let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const abortController = new AbortController();
  const blobUrls: string[] = [];

  const cleanup = () => {
    disposed = true;
    if (reconnectTimeoutId !== null) {
      clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }
    abortController.abort();
    blobUrls.forEach(url => URL.revokeObjectURL(url));
    blobUrls.length = 0;
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close();
    }
  };

  const connect = (): WebSocket => {
    ws = new WebSocket(`${process.env.REACT_APP_MESHY_WEBSOCKET}/ws/${portId}`);
    let isFirstMessage = true;

    ws.onmessage = async (event) => {
      if (disposed) return;
      if (!event.data || typeof event.data !== 'string') return;

      if (isFirstMessage) {
        dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
        isFirstMessage = false;
      }

      const parts = event.data.split(",");
      if (parts.length !== 3) {
        logger.warn("Unexpected WebSocket message format:", event.data);
        return;
      }

      const percentageComplete = parseInt(parts[0], 10);
      const taskId = parts[1];
      const fileName = parts[2];

      if (isNaN(percentageComplete) || !taskId || !fileName) {
        logger.warn("Invalid WebSocket message data:", event.data);
        return;
      }

      dispatch(setMeshyLoadedPercentage({ meshyLoadedPercentage: percentageComplete }));
      dispatch(setMeshyPending({ meshyPending: false }));
      dispatch(setMeshyQueueItems({ meshyQueueItems: 0 }));
      dispatch(setMeshyLoading({ meshyLoading: true }));

      if (percentageComplete === 100) {
        try {
          const fileData = await fetchFile(taskId, abortController.signal);
          const fileInfo = extractFileInfo(fileData, fileName);
          blobUrls.push(fileInfo.fileUrl);
          setActualFile(fileInfo.file);
          dispatch(setFromMeshyOrHistory({ fromMeshyOrHistory: true }));
          dispatch(setFileProperties({
            selectedFile: fileInfo.fileUrl,
            selectedFileType: 'obj',
            fileNameBoxValue: fileName,
          }));
        } catch (err) {
          if (!disposed) {
            logger.error("Error fetching completed file:", err);
          }
        }
        ws.close();
        dispatch(setMeshyLoading({ meshyLoading: false }));
        dispatch(setMeshyPreviewTaskId({ meshyPreviewTaskId: taskId }));
      }
    };

    ws.onerror = (error) => {
      logger.error("WebSocket error:", error);
    };

    ws.onclose = (event) => {
      dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
      dispatch(setMeshyLoading({ meshyLoading: false }));

      // Reconnect with exponential backoff if not a clean close
      if (!disposed && !event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
        reconnectAttempts++;
        logger.warn(`WebSocket closed unexpectedly. Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        reconnectTimeoutId = setTimeout(() => connect(), delay);
      }
    };

    return ws;
  };

  ws = connect();
  return { ws, cleanup };
};


export const handleMeshyData = async (data: MeshyTaskStatusResponse, dispatch: AppDispatch) => {
  if (data.status === 'PENDING' && data.preceding_tasks) {
    dispatch(setMeshyPending({ meshyPending: true }));
    dispatch(setMeshyQueueItems({ meshyQueueItems: data.preceding_tasks }));
  } else {
    dispatch(setMeshyPending({ meshyPending: false }));
    dispatch(setMeshyQueueItems({ meshyQueueItems: 0 }));
    dispatch(setMeshyLoading({ meshyLoading: true }));
    if (data.progress !== undefined) {
      dispatch(setMeshyLoadedPercentage({ meshyLoadedPercentage: data.progress }));
    }
  }
}
