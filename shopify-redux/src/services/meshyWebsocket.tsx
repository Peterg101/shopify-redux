import { AppDispatch } from "../app/store";
import { authApi } from "./authApi";
import { MeshyTaskStatusResponse } from "./meshyApi";
import { setMeshyLoadedPercentage, setMeshyLoading, setMeshyPending, setMeshyQueueItems } from "./userInterfaceSlice";
import { extractFileInfo, fetchFile } from "./fetchFileUtils";
import { setFileProperties } from "./dataSlice";

export const createWebsocketConnection = (
  taskId: string,
  dispatch: AppDispatch,
  setActualFile: React.Dispatch<React.SetStateAction<File | null>>
): WebSocket => {
  const ws = new WebSocket(`ws://localhost:1234/ws/${taskId}`);

  ws.onopen = () => {
    console.log("WebSocket connection opened.");
  };

  ws.onmessage = async (event) => {
    console.log('DATAAAAAAAAA')
    console.log("Message from server:", event.data);
    // const parsedData = JSON.parse(event.data)
    // console.log('PAAAAAAARSED DATA')
    // console.log(parsedData)
    // await handleMeshyData(parsedData, dispatch)
    if (event.data.includes("Progress:")) {
      const progressMatch = event.data.match(/Progress: (\d+)%/);
      const progressInt = parseInt(progressMatch[1], 10)
      const meshyTaskIdMatch = event.data.match(/MeshyTaskId:\s*(.+)/)
      const meshyTaskId = meshyTaskIdMatch[1]
      if (meshyTaskIdMatch){
        console.log(meshyTaskIdMatch[1])
      }
      if (progressMatch && progressInt) {
        console.log('PROGRESS MAAAAAAAAATCH')
        dispatch(setMeshyLoadedPercentage({meshyLoadedPercentage: progressInt}));
        dispatch(setMeshyPending({meshyPending: false}))
        dispatch(setMeshyQueueItems({ meshyQueueItems: 0 }));
        dispatch(setMeshyLoading({meshyLoading: true}))
        if(progressInt == 100){
          const fileData = await fetchFile(meshyTaskId)
          const fileInfo = extractFileInfo(fileData, 'filenaynay')
          setActualFile(fileInfo.file)
          dispatch(setFileProperties({
            selectedFile: fileInfo.fileUrl,
            selectedFileType: 'obj',
            fileNameBoxValue: 'filenaynay',
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
    console.log(`WebSocket connection closed: ${event.code}, ${event.reason}`);
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