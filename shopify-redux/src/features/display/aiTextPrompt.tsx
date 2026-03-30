import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import React, { useState, ChangeEvent, KeyboardEvent, useRef } from 'react';
import { generateUUID } from 'three/src/math/MathUtils';
import { useFile } from '../../services/fileProvider';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { setMeshyPending } from '../../services/meshySlice';
import { authApi } from '../../services/authApi';
import { connectProgressStream } from '../../services/progressStream';
import { startTask } from '../../services/fetchFileUtils';
import { GenerationSettings } from './GenerationSettings';
import { glowMedium } from '../../theme';

const AiTextPrompt = () => {
  const userInformation = useSelector((state: RootState) => state.userInterfaceState.userInformation);
  const meshyState = useSelector((state: RootState) => state.meshyState);
  const { setActualFile } = useFile();
  const dispatch = useDispatch();
  const [disabledField, setDisabledField] = useState(false);
  const textFieldRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  const isGenerating = meshyState.meshyPending || meshyState.meshyLoading;

  const handleKeyPress = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && value.trim()) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };

  const handleSubmit = async () => {
    if (userInformation && value.trim()) {
      const portId = generateUUID();
      setDisabledField(true);
      dispatch(setMeshyPending({ meshyPending: true }));
      await startTask(value, userInformation.user.user_id, portId, meshyState.meshyGenerationSettings);
      dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
      connectProgressStream(portId, 'meshy', dispatch, setActualFile);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <TextField
          disabled={disabledField}
          placeholder="What would you like to model?"
          variant="outlined"
          fullWidth
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyPress}
          multiline
          inputRef={textFieldRef}
          minRows={2}
          maxRows={4}
          inputProps={{ maxLength: 600 }}
          sx={{
            '& .MuiOutlinedInput-root': {
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
                boxShadow: `0 0 12px ${glowMedium}`,
              },
            },
          }}
        />
        <Button
          variant="contained"
          color="primary"
          disabled={!value.trim() || disabledField || isGenerating}
          onClick={handleSubmit}
          startIcon={<AutoAwesomeIcon />}
          sx={{
            minWidth: 120,
            height: 56,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {isGenerating ? 'Generating...' : 'Generate'}
        </Button>
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 0.5, display: 'block', textAlign: 'right', opacity: 0.5 }}
      >
        {value.length}/600
      </Typography>
      <Collapse in={value.length > 0}>
        <Box sx={{ mt: 1.5 }}>
          <GenerationSettings mode="text" />
        </Box>
      </Collapse>
    </Box>
  );
};

export default AiTextPrompt;
