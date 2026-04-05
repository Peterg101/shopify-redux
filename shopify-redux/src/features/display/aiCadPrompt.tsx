import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import React, { useState, useEffect, ChangeEvent, KeyboardEvent, useRef } from 'react';
import { generateUUID } from 'three/src/math/MathUtils';
import { useFile } from '../../services/fileProvider';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { setCadPending } from '../../services/cadSlice';
import { authApi } from '../../services/authApi';
import { connectProgressStream } from '../../services/progressStream';
import { startCadTask } from '../../services/fetchFileUtils';
import { CadDesignIntent, CadFeatureSettings } from './CadGenerationSettings';
import { glowMedium } from '../../theme';

const AiCadPrompt = () => {
  const userInformation = useSelector((state: RootState) => state.userInterfaceState.userInformation);
  const cadState = useSelector((state: RootState) => state.cadState);
  const { setActualFile } = useFile();
  const dispatch = useDispatch();
  const [disabledField, setDisabledField] = useState(false);
  const textFieldRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  const isGenerating = cadState.cadPending || cadState.cadLoading;

  // Reset disabled field when generation completes, fails, or is cleared
  useEffect(() => {
    if (!cadState.cadPending && !cadState.cadLoading) {
      setDisabledField(false);
    }
  }, [cadState.cadPending, cadState.cadLoading]);

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
      dispatch(setCadPending({ cadPending: true }));
      await startCadTask(value, userInformation.user.user_id, portId, cadState.cadGenerationSettings);
      dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
      connectProgressStream(portId, 'cad', dispatch, setActualFile);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <CadDesignIntent />
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <TextField
          disabled={disabledField}
          placeholder="Describe geometry with specific dimensions, e.g: A rectangular plate 100×60×5mm with four 4.5mm through-holes 8mm from each corner and a 40×20mm rectangular cutout centered on the top face"
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
          startIcon={<PrecisionManufacturingIcon />}
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
        sx={{
          mt: 0.5,
          display: 'block',
          textAlign: 'right',
          opacity: value.length > 500 ? 1 : 0.5,
          color: value.length >= 600 ? 'error.main' : value.length >= 550 ? 'warning.main' : 'text.secondary',
        }}
      >
        {value.length}/600
      </Typography>
      <Collapse in={value.length > 0}>
        <Box sx={{ mt: 1.5 }}>
          <CadFeatureSettings />
        </Box>
      </Collapse>
    </Box>
  );
};

export default AiCadPrompt;
