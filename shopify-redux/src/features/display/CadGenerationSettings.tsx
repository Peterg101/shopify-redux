import React from 'react';
import {
  Box,
  Typography,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TuneIcon from '@mui/icons-material/Tune';
import { SelectChangeEvent } from '@mui/material/Select';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { setCadGenerationSettings } from '../../services/cadSlice';

export const CadSettings = () => {
  const dispatch = useDispatch();
  const settings = useSelector((state: RootState) => state.cadState.cadGenerationSettings);

  const handleIterationsChange = (_: Event, value: number | number[]) => {
    if (typeof value === 'number') {
      dispatch(setCadGenerationSettings({ settings: { max_iterations: value } }));
    }
  };

  const handleTimeoutChange = (_: Event, value: number | number[]) => {
    if (typeof value === 'number') {
      dispatch(setCadGenerationSettings({ settings: { timeout_seconds: value } }));
    }
  };

  const handleUnitsChange = (event: SelectChangeEvent) => {
    dispatch(setCadGenerationSettings({ settings: { target_units: event.target.value } }));
  };

  return (
    <Accordion
      sx={{
        backgroundColor: 'transparent',
        backgroundImage: 'none',
        boxShadow: 'none',
        '&:before': { display: 'none' },
        border: '1px solid rgba(0, 229, 255, 0.12)',
        borderRadius: '8px !important',
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneIcon sx={{ color: 'primary.main', fontSize: 18 }} />
          <Typography variant="body2" fontWeight={500}>
            CAD Settings
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Max iterations */}
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Max retry attempts: {settings.max_iterations}
            </Typography>
            <Slider
              value={settings.max_iterations}
              onChange={handleIterationsChange}
              min={1}
              max={5}
              step={1}
              marks
              size="small"
            />
          </Box>

          {/* Timeout */}
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Execution timeout: {settings.timeout_seconds}s
            </Typography>
            <Slider
              value={settings.timeout_seconds}
              onChange={handleTimeoutChange}
              min={10}
              max={60}
              step={5}
              marks={[
                { value: 10, label: '10s' },
                { value: 30, label: '30s' },
                { value: 60, label: '60s' },
              ]}
              size="small"
            />
          </Box>

          {/* Target units */}
          <FormControl size="small" fullWidth>
            <InputLabel>Units</InputLabel>
            <Select
              value={settings.target_units}
              label="Units"
              onChange={handleUnitsChange}
            >
              <MenuItem value="mm">Millimeters (mm)</MenuItem>
              <MenuItem value="inches">Inches</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};
