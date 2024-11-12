import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import React, { useState, ChangeEvent, KeyboardEvent, useRef, useCallback } from 'react';
import { generateUUID } from 'three/src/math/MathUtils';
import { MeshyTaskStatusResponse, MeshyPayload } from '../../services/meshyApi';
import { useFile } from '../../services/fileProvider';
import { useDispatch } from 'react-redux';
import { setFileProperties } from '../../services/dataSlice';
import { extractFileType } from '../../app/utility/utils';
import { setMeshyLoadedPercentage, setMeshyLoading, setMeshyPending, setMeshyQueueItems } from '../../services/userInterfaceSlice';

const AiTextPrompt = () => {
  const {actualFile, setActualFile} = useFile()
  const dispatch = useDispatch()
  const [meshyData, setMeshyData] = useState<MeshyTaskStatusResponse | null>(null);
  const meshyDataRef = useRef<MeshyTaskStatusResponse | null>(null);
  const [disabledField, setDisabledField] = useState<boolean>(false);
  const textFieldRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<string>('');

  const handleKeyPress = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && value) {
      handleSubmit();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };


  const handleMeshyData = useCallback(async (data: MeshyTaskStatusResponse) => {
    setMeshyData(data); 
    meshyDataRef.current = data; 
    if (data.status === 'PENDING' && data.preceding_tasks) {
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
    if (data.obj_file_blob) {
      // Handle file conversion and downloading logic
      const byteCharacters = atob(data.obj_file_blob);
      const byteNumbers = Array.from(byteCharacters).map((char) => char.charCodeAt(0));
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const filename = `${value}.obj`;

      const file = new File([blob], filename, {type: blob.type})
      setActualFile(file)

      const fileURL = URL.createObjectURL(file)

      dispatch(setFileProperties({
        fileNameBoxValue: filename,
        selectedFile: fileURL,
        selectedFileType: "obj"
      }))

      // Download trigger
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [value]);

  const handleSubmit = async () => {
    setDisabledField(true);
    
    const ws = new WebSocket("ws://localhost:1234/ws");

    ws.onopen = () => {
      const payload: MeshyPayload = {
        mode: 'preview',
        prompt: value,
        art_style: 'realistic',
        negative_prompt: 'low quality, low resolution, low poly, ugly',
      };
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = async (event) => {
      console.log("Received from server:", event.data);
      try {
        const parsedData = JSON.parse(event.data);
        await handleMeshyData(parsedData);
      } catch (error) {
        console.error("Error parsing received data:", error);
      }
    };

    ws.onclose = () => {

      setValue('');
      setDisabledField(false);
      if (textFieldRef.current) {
        textFieldRef.current.blur();
      }
      dispatch(setMeshyLoading({meshyLoading: false}))
      console.log(meshyDataRef.current); // Use the ref for the latest meshyData
      if (meshyDataRef.current && meshyDataRef.current.obj_file_blob) {
        console.log("OBJ file is successfully processed and downloaded.");
      } else {
        console.warn("OBJ URL Blob not found in task data.");
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setDisabledField(false);
    };
  };

  return (
    <Box sx={{ width: '100%' }}>
      <TextField
        disabled={disabledField}
        label="What would you like to model?"
        variant="outlined"
        sx={{ width: '100%' }}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyPress}
        multiline
        inputRef={textFieldRef}
        minRows={2}
        maxRows={4}
        inputProps={{ maxLength: 300 }}
      />
    </Box>
  );
};

export default AiTextPrompt;
