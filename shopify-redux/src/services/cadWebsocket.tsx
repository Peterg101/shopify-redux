import { AppDispatch } from "../app/store";
import { authApi } from "./authApi";
import logger from '../app/utility/logger';
import { setCadLoadedPercentage, setCadLoading, setCadStatusMessage, setCadError } from "./cadSlice";
import { setFileProperties, setFromMeshyOrHistory } from "./dataSlice";

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;

export const createCadWebsocketConnection = (
  portId: string,
  dispatch: AppDispatch,
  setActualFile: React.Dispatch<React.SetStateAction<File | null>>
): WebSocket => {
  let reconnectAttempts = 0;
  let ws: WebSocket;

  const connect = (): WebSocket => {
    ws = new WebSocket(`${process.env.REACT_APP_CAD_WEBSOCKET}/ws/${portId}`);
    let isFirstMessage = true;

    ws.onmessage = async (event) => {
      if (!event.data || typeof event.data !== 'string') return;

      if (isFirstMessage) {
        dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
        isFirstMessage = false;
      }

      const data = event.data;

      // Handle failure
      if (data.startsWith("Task Failed")) {
        const errorMsg = data.replace("Task Failed,", "");
        dispatch(setCadError({ cadError: errorMsg }));
        dispatch(setCadLoading({ cadLoading: false }));
        ws.close();
        return;
      }

      // Handle completion: "Task Completed,{task_id},{name},{job_id}"
      if (data.startsWith("Task Completed")) {
        const parts = data.split(",");
        const fileName = parts[2] || "generated";
        const jobId = parts[3];

        try {
          // Fetch presigned glB preview URL from step_service
          const previewResp = await fetch(
            `${process.env.REACT_APP_STEP_SERVICE}/step/${jobId}/preview_url`
          );
          if (!previewResp.ok) {
            throw new Error(`Preview URL request failed: ${previewResp.status}`);
          }
          const { url: presignedUrl } = await previewResp.json();

          // Fetch the glB binary from MinIO
          const glbResp = await fetch(presignedUrl);
          if (!glbResp.ok) {
            throw new Error(`glB fetch failed: ${glbResp.status}`);
          }
          const glbBlob = await glbResp.blob();
          const glbFile = new File([glbBlob], `${fileName}.glb`, { type: "model/gltf-binary" });
          const blobUrl = URL.createObjectURL(glbBlob);

          setActualFile(glbFile);
          dispatch(setFromMeshyOrHistory({ fromMeshyOrHistory: true }));
          dispatch(setFileProperties({
            selectedFile: blobUrl,
            selectedFileType: 'glb',
            fileNameBoxValue: fileName,
          }));
        } catch (err) {
          logger.error("Error fetching completed CAD file:", err);
        }
        dispatch(setCadLoading({ cadLoading: false }));
        ws.close();
        return;
      }

      // Handle progress: "{percentage},{status_message},{name}"
      const parts = data.split(",");
      if (parts.length >= 2) {
        const percentage = parseInt(parts[0], 10);
        const statusMessage = parts[1];

        if (!isNaN(percentage)) {
          dispatch(setCadLoadedPercentage({ cadLoadedPercentage: percentage }));
          dispatch(setCadStatusMessage({ cadStatusMessage: statusMessage }));
          dispatch(setCadLoading({ cadLoading: true }));
        }
      }
    };

    ws.onerror = (error) => {
      logger.error("CAD WebSocket error:", error);
    };

    ws.onclose = (event) => {
      dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
      dispatch(setCadLoading({ cadLoading: false }));

      if (!event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
        reconnectAttempts++;
        logger.warn(`CAD WebSocket closed unexpectedly. Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(() => connect(), delay);
      }
    };

    return ws;
  };

  return connect();
};
