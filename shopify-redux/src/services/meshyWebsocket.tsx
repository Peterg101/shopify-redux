import { AppDispatch } from "../app/store";
import { authApi } from "./authApi";
import { MeshyTaskStatusResponse } from "./meshyApi";
import { setMeshyLoadedPercentage, setMeshyLoading, setMeshyPending, setMeshyQueueItems, setMeshyPreviewTaskId, setMeshyRefining } from "./userInterfaceSlice";
import { extractFileInfo, fetchFile } from "./fetchFileUtils";
import { setFileProperties, setFromMeshyOrHistory } from "./dataSlice";

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;

export const createWebsocketConnection = (
  portId: string,
  dispatch: AppDispatch,
  setActualFile: React.Dispatch<React.SetStateAction<File | null>>
): WebSocket => {
  let reconnectAttempts = 0;
  let ws: WebSocket;

  const connect = (): WebSocket => {
    ws = new WebSocket(`${process.env.REACT_APP_MESHY_WEBSOCKET}/ws/${portId}`);
    let isFirstMessage = true;

    ws.onmessage = async (event) => {
      if (!event.data || typeof event.data !== 'string') return;

      if (isFirstMessage) {
        dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
        isFirstMessage = false;
      }

      const parts = event.data.split(",");
      if (parts.length !== 3) {
        console.warn("Unexpected WebSocket message format:", event.data);
        return;
      }

      const percentageComplete = parseInt(parts[0], 10);
      const taskId = parts[1];
      const fileName = parts[2];

      if (isNaN(percentageComplete) || !taskId || !fileName) {
        console.warn("Invalid WebSocket message data:", event.data);
        return;
      }

      dispatch(setMeshyLoadedPercentage({ meshyLoadedPercentage: percentageComplete }));
      dispatch(setMeshyPending({ meshyPending: false }));
      dispatch(setMeshyQueueItems({ meshyQueueItems: 0 }));
      dispatch(setMeshyLoading({ meshyLoading: true }));

      if (percentageComplete === 100) {
        try {
          const fileData = await fetchFile(taskId);
          const fileInfo = extractFileInfo(fileData, fileName);
          setActualFile(fileInfo.file);
          dispatch(setFromMeshyOrHistory({ fromMeshyOrHistory: true }));
          dispatch(setFileProperties({
            selectedFile: fileInfo.fileUrl,
            selectedFileType: 'obj',
            fileNameBoxValue: fileName,
          }));
        } catch (err) {
          console.error("Error fetching completed file:", err);
        }
        ws.close();
        dispatch(setMeshyLoading({ meshyLoading: false }));
        dispatch(setMeshyPreviewTaskId({ meshyPreviewTaskId: taskId }));
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = (event) => {
      dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
      dispatch(setMeshyLoading({ meshyLoading: false }));

      // Reconnect with exponential backoff if not a clean close
      if (!event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
        reconnectAttempts++;
        console.warn(`WebSocket closed unexpectedly. Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(() => connect(), delay);
      }
    };

    return ws;
  };

  return connect();
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
