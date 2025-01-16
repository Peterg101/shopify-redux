import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import React, { useState, ChangeEvent, KeyboardEvent, useRef, useCallback, useEffect } from 'react';
import { generateUUID } from 'three/src/math/MathUtils';
import { MeshyTaskStatusResponse, MeshyPayload } from '../../services/meshyApi';
import { useFile } from '../../services/fileProvider';
import { useDispatch } from 'react-redux';
import { setFileProperties } from '../../services/dataSlice';
import { extractFileType } from '../../app/utility/utils';
import { setMeshyLoadedPercentage, setMeshyLoading, setMeshyPending, setMeshyQueueItems, userInterfaceSlice } from '../../services/userInterfaceSlice';
import { useSelector } from 'react-redux';
import { RootState } from "../../app/store";
import { authApi } from '../../services/authApi';
import { createWebsocketConnection } from '../../services/meshyWebsocket';
import { startTask } from '../../services/fetchFileUtils';




const AiTextPrompt = () => {
  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
  )
  const {actualFile, setActualFile} = useFile()
  const dispatch = useDispatch()
  const [disabledField, setDisabledField] = useState<boolean>(false);
  const textFieldRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<string>('');

  const handleKeyPress = (event: KeyboardEvent<HTMLDivElement>) => {
    console.log('BUTTON PRESSED')
    if (event.key === 'Enter' && value) {
      handleSubmit();
      dispatch(setMeshyPending({meshyPending: true}))
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };

  const handleSubmit = async () => {
    if(userInterfaceState.userInformation){
      const portId = generateUUID()
      setDisabledField(true);
      dispatch(setMeshyPending({meshyPending: true}))
      console.log('starting task')
      await startTask(value, userInterfaceState.userInformation?.user.user_id, portId)
      dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
      createWebsocketConnection(portId, dispatch, setActualFile)
      

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
