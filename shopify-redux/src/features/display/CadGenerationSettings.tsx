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
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TuneIcon from '@mui/icons-material/Tune';
import LayersIcon from '@mui/icons-material/Layers';
import ConstructionIcon from '@mui/icons-material/Construction';
import { SelectChangeEvent } from '@mui/material/Select';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { setCadGenerationSettings } from '../../services/cadSlice';
import { borderSubtle, bgHighlight, glowSubtle } from '../../theme';

const PROCESS_OPTIONS = [
  { value: 'fdm', label: 'FDM', icon: <LayersIcon sx={{ fontSize: 14 }} /> },
  { value: 'sla', label: 'SLA' },
  { value: 'sls', label: 'SLS' },
  { value: 'cnc', label: 'CNC', icon: <ConstructionIcon sx={{ fontSize: 14 }} /> },
  { value: 'injection', label: 'Injection' },
];

const MATERIAL_OPTIONS = [
  { value: 'plastic', label: 'Plastic' },
  { value: 'metal', label: 'Metal' },
  { value: 'rubber', label: 'Rubber' },
];

const FEATURE_OPTIONS = [
  { value: 'hollow', label: 'Hollow / Shelled' },
  { value: 'fillets', label: 'Add fillets' },
  { value: 'mounting_holes', label: 'Mounting holes' },
  { value: 'text_engraving', label: 'Text engraving' },
];

const toggleButtonSx = {
  px: 1.5,
  py: 0.25,
  fontSize: '0.75rem',
  textTransform: 'none' as const,
  borderColor: borderSubtle,
  '&:hover': {
    backgroundColor: glowSubtle,
  },
  '&.Mui-selected': {
    backgroundColor: bgHighlight,
    borderColor: 'primary.main',
    color: 'primary.main',
  },
};

export const CadDesignIntent = () => {
  const dispatch = useDispatch();
  const settings = useSelector((state: RootState) => state.cadState.cadGenerationSettings);

  const size = settings.approximate_size ?? { width: null, depth: null, height: null };

  const handleProcessChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (value) {
      dispatch(setCadGenerationSettings({ settings: { process: value } }));
    }
  };

  const handleMaterialChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (value) {
      dispatch(setCadGenerationSettings({ settings: { material_hint: value } }));
    }
  };

  const handleSizeChange = (dimension: 'width' | 'depth' | 'height') => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const val = e.target.value === '' ? null : Number(e.target.value);
    const newSize = { ...size, [dimension]: val };
    const allNull = newSize.width === null && newSize.depth === null && newSize.height === null;
    dispatch(setCadGenerationSettings({ settings: { approximate_size: allNull ? null : newSize } }));
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        gap: 2,
        mb: 1.5,
      }}
    >
      {/* Process */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          Process
        </Typography>
        <ToggleButtonGroup
          value={settings.process}
          exclusive
          onChange={handleProcessChange}
          size="small"
        >
          {PROCESS_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value} sx={toggleButtonSx}>
              {opt.icon && <Box component="span" sx={{ mr: 0.5, display: 'inline-flex', alignItems: 'center' }}>{opt.icon}</Box>}
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Approximate size */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          Approx. size (mm)
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TextField
            type="number"
            size="small"
            placeholder="Width"
            value={size.width ?? ''}
            onChange={handleSizeChange('width')}
            sx={{ width: 70 }}
            inputProps={{ min: 0, step: 1 }}
          />
          <Typography variant="caption" color="text.secondary">&times;</Typography>
          <TextField
            type="number"
            size="small"
            placeholder="Depth"
            value={size.depth ?? ''}
            onChange={handleSizeChange('depth')}
            sx={{ width: 70 }}
            inputProps={{ min: 0, step: 1 }}
          />
          <Typography variant="caption" color="text.secondary">&times;</Typography>
          <TextField
            type="number"
            size="small"
            placeholder="Height"
            value={size.height ?? ''}
            onChange={handleSizeChange('height')}
            sx={{ width: 70 }}
            inputProps={{ min: 0, step: 1 }}
          />
        </Box>
      </Box>

      {/* Material */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          Material
        </Typography>
        <ToggleButtonGroup
          value={settings.material_hint}
          exclusive
          onChange={handleMaterialChange}
          size="small"
        >
          {MATERIAL_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value} sx={toggleButtonSx}>
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
};

export const CadFeatureSettings = () => {
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

  const handleFeatureToggle = (feature: string) => (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    const current = settings.features;
    const updated = checked ? [...current, feature] : current.filter((f) => f !== feature);
    dispatch(setCadGenerationSettings({ settings: { features: updated } }));
  };

  return (
    <Accordion
      sx={{
        backgroundColor: 'transparent',
        backgroundImage: 'none',
        boxShadow: 'none',
        '&:before': { display: 'none' },
        border: `1px solid ${borderSubtle}`,
        borderRadius: '8px !important',
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneIcon sx={{ color: 'primary.main', fontSize: 18 }} />
          <Typography variant="body2" fontWeight={500}>
            Features &amp; Settings
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Feature toggles */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Design features
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 0,
              }}
            >
              {FEATURE_OPTIONS.map((opt) => (
                <FormControlLabel
                  key={opt.value}
                  control={
                    <Checkbox
                      size="small"
                      checked={settings.features.includes(opt.value)}
                      onChange={handleFeatureToggle(opt.value)}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                      {opt.label}
                    </Typography>
                  }
                />
              ))}
            </Box>
          </Box>

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
