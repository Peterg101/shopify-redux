import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import React, { useState, ChangeEvent, KeyboardEvent, useRef } from 'react';
import { generateUUID } from 'three/src/math/MathUtils';
import { MeshyTaskStatusResponse, MeshyPayload } from '../../services/meshyApi';
import { useFile } from '../../services/fileProvider';
import { useDispatch } from 'react-redux';
import { setFileProperties } from '../../services/dataSlice';
import { extractFileType } from '../../app/utility/utils';

const AiTextPrompt = () => {
  const {actualFile, setActualFile} = useFile()
  const dispatch = useDispatch()
  const [meshyData, setMeshyData] = useState<MeshyTaskStatusResponse>();
  const [disabledField, setDisabledField] = useState<boolean>(false);
  const textFieldRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<string>('');

  // const downloadAndSetFile = async (url: string) => {
  //   try {
  //     const response = await fetch(url);
  //     if (!response.ok) {
  //       throw new Error('Network response was not ok');
  //     }
  //     const blob = await response.blob();
  //     const newUrl = URL.createObjectURL(blob);
  //     const uuid = generateUUID();
  //     const filename = `generated_file_${uuid}.obj`;
  //     const file = new File([blob], filename, { type: blob.type });

  //     // Assuming these handlers are available, uncomment and set the states
  //     // setActualFile(file);
  //     // setSelectedFile(newUrl);
  //     // setSelectedFileType('obj');
      
  //     console.log("Downloaded file:", file, "URL:", newUrl);
  //   } catch (error) {
  //     console.error('Error downloading file:', error);
  //   }
  // };
  

  const handleKeyPress = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && value) {
      handleSubmit();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };

  const handleMeshyData = async (data: MeshyTaskStatusResponse) => {
    console.log(data)
    setMeshyData(data)
  }

  const handleSubmit = async () => {
    setDisabledField(true);

    console.log('Submitting with value:', value);
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
        console.log(parsedData);
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
      console.log(meshyData)
      if (meshyData && meshyData.obj_file_blob) {
        // Decode the Base64 string and create a Blob
        
        const byteCharacters = atob(meshyData.obj_file_blob); // Decodes Base64 to binary string
        const byteNumbers = new Array(byteCharacters.length).fill(0).map((_, i) => byteCharacters.charCodeAt(i));
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/octet-stream' });
        const filename = `${value}.obj`
        const file = new File([blob], filename, { type: blob.type });
        setActualFile(file)
        const url = URL.createObjectURL(blob);
        console.log(url)
        dispatch(setFileProperties({
          fileNameBoxValue: filename,
          selectedFile: url,
          selectedFileType: "obj"
        }))

        // Create a download link
        
        // const a = document.createElement('a');
        // a.href = url;
        // a.download = filename; // Specify the file name
        // document.body.appendChild(a);
        // a.click();
        // document.body.removeChild(a); // Clean up after download
        // URL.revokeObjectURL(url); // Free up memory
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
