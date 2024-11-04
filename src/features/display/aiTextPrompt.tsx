import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import React, { useState, ChangeEvent, KeyboardEvent, useRef } from 'react';
import { generateUUID } from 'three/src/math/MathUtils';

const AiTextPrompt = () => {
  const [disabledField, setDisabledField] = useState<boolean>(false);
  const textFieldRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<string>('');

  const downloadAndSetFile = async (url: string) => {
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
    const fileUrl = `${proxyUrl}${url}`;
    try {
      const response = await fetch(fileUrl);

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const blob = await response.blob();
      const newUrl = URL.createObjectURL(blob);
      const uuid = generateUUID();
      const filename: string = `generated_file${uuid}.obj`;
      const file = new File([blob], filename, { type: blob.type });

      // Assuming these handlers are available, uncomment and set the states
      // setActualFile(file);
      // setSelectedFile(newUrl);
      // setSelectedFileType('obj');
      
      console.log(blob, newUrl); // Debug logs
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && value) {
      handleSubmit();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };

  const handleSubmit = async () => {
    setDisabledField(true);

    // Here you can include your async logic to handle tasks, etc.
    // Example:
    console.log('Submitting with value:', value);
    // Uncomment to call the async task processing or API here.

    setValue('');
    setDisabledField(false);

    if (textFieldRef.current) {
      textFieldRef.current.blur();
    }
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
