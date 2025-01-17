import { AppDispatch } from "../app/store";
import { authApi } from "./authApi";
import { MeshyTaskStatusResponse } from "./meshyApi";
import { setMeshyLoadedPercentage, setMeshyLoading, setMeshyPending, setMeshyQueueItems } from "./userInterfaceSlice";
import { extractFileInfo, fetchFile } from "./fetchFileUtils";
import { setFileProperties } from "./dataSlice";

export const createWebsocketConnection = (
  portId: string,
  dispatch: AppDispatch,
  setActualFile: React.Dispatch<React.SetStateAction<File | null>>
): WebSocket => {
  const ws = new WebSocket(`ws://localhost:1234/ws/${portId}`);

  ws.onmessage = async (event) => {
    if (event.data) {
      const parts = event.data.split(",");
      if (parts.length === 3) {
        const percentageComplete = parseInt(parts[0], 10); // Convert to a number
        const taskId = parts[1];                          // Task ID as a string
        const fileName = parts[2];  
        dispatch(setMeshyLoadedPercentage({meshyLoadedPercentage: percentageComplete}));
        dispatch(setMeshyPending({meshyPending: false}))
        dispatch(setMeshyQueueItems({ meshyQueueItems: 0 }));
        dispatch(setMeshyLoading({meshyLoading: true}))
        if(percentageComplete == 100){
          const fileData = await fetchFile(taskId)
          const fileInfo = extractFileInfo(fileData, fileName)
          setActualFile(fileInfo.file)
          dispatch(setFileProperties({
            selectedFile: fileInfo.fileUrl,
            selectedFileType: 'obj',
            fileNameBoxValue: fileName,
        }));
    
          ws.close()
          dispatch(setMeshyLoading({meshyLoading: false}))
        }
      }
    }
  };

  ws.onerror = (error) => {

    ws.close()
    console.error("WebSocket error:", error);
  };

  ws.onclose = (event) => {
    ws.close()
    dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
    dispatch(setMeshyLoading({meshyLoading: false}))
  };

  return ws;
};


export const handleMeshyData = async (data: MeshyTaskStatusResponse, dispatch: AppDispatch) => {
  if(data.status === 'PENDING' && data.preceding_tasks){
    dispatch(setMeshyPending({meshyPending: true}))
    dispatch(setMeshyQueueItems({ meshyQueueItems: data.preceding_tasks }));
  } else {
    dispatch(setMeshyPending({meshyPending: false}))
    dispatch(setMeshyQueueItems({ meshyQueueItems: 0 }));
    dispatch(setMeshyLoading({meshyLoading: true}))
    if (data.progress !== undefined) {
      dispatch(setMeshyLoadedPercentage({ meshyLoadedPercentage: data.progress }));
    }
  }
}