import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Popover,
  IconButton,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import LayersIcon from '@mui/icons-material/Layers';
import ConstructionIcon from '@mui/icons-material/Construction';
import { SelectChangeEvent } from '@mui/material/Select';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { setCadGenerationSettings } from '../../services/cadSlice';
import { borderSubtle, borderHover, bgHighlightHover, glowSubtle, monoFontFamily } from '../../theme';

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
  px: 2,
  py: 0.75,
  fontSize: '0.8rem',
  fontWeight: 500,
  textTransform: 'none' as const,
  borderColor: borderSubtle,
  '&:hover': {
    backgroundColor: bgHighlightHover,
    borderColor: borderHover,
  },
  '&.Mui-selected': {
    backgroundColor: bgHighlightHover,
    borderColor: 'primary.main',
    color: 'primary.main',
    boxShadow: `0 0 8px ${glowSubtle}`,
  },
};

const chipSx = (active: boolean) => ({
  fontSize: '0.7rem',
  height: 22,
  borderColor: active ? 'primary.main' : borderSubtle,
  color: 'primary.main',
  boxShadow: active ? `0 0 8px ${glowSubtle}` : 'none',
  cursor: 'pointer',
  '&:hover': { backgroundColor: bgHighlightHover, borderColor: borderHover },
});

const popoverPaperSx = {
  mt: 0.5,
  border: `1px solid ${borderSubtle}`,
  backgroundColor: 'rgba(19,25,32,0.95)',
  backdropFilter: 'blur(8px)',
  p: 2,
};

const sectionLabelSx = {
  mb: 1,
  display: 'block',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  fontSize: '0.7rem',
  fontWeight: 600,
};

function useAnchor() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  return {
    anchorEl,
    open: Boolean(anchorEl),
    onOpen: (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget),
    onClose: () => setAnchorEl(null),
  };
}

export const ProcessChipControl = () => {
  const dispatch = useDispatch();
  const process = useSelector((s: RootState) => s.cadState.cadGenerationSettings.process);
  const { anchorEl, open, onOpen, onClose } = useAnchor();
  const label = PROCESS_OPTIONS.find((o) => o.value === process)?.label ?? process;

  const handleChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (value) dispatch(setCadGenerationSettings({ settings: { process: value } }));
  };

  return (
    <>
      <Chip label={label} size="small" variant="outlined" onClick={onOpen} sx={chipSx(true)} />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{ sx: popoverPaperSx }}
      >
        <Typography variant="caption" color="text.secondary" sx={sectionLabelSx}>
          Process
        </Typography>
        <ToggleButtonGroup
          value={process}
          exclusive
          onChange={handleChange}
          size="small"
          sx={{ flexWrap: 'wrap' }}
        >
          {PROCESS_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value} sx={toggleButtonSx}>
              {opt.icon && (
                <Box component="span" sx={{ mr: 0.5, display: 'inline-flex', alignItems: 'center' }}>
                  {opt.icon}
                </Box>
              )}
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Popover>
    </>
  );
};

export const MaterialChipControl = () => {
  const dispatch = useDispatch();
  const material = useSelector((s: RootState) => s.cadState.cadGenerationSettings.material_hint);
  const { anchorEl, open, onOpen, onClose } = useAnchor();
  const label = MATERIAL_OPTIONS.find((o) => o.value === material)?.label ?? material;

  const handleChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (value) dispatch(setCadGenerationSettings({ settings: { material_hint: value } }));
  };

  return (
    <>
      <Chip label={label} size="small" variant="outlined" onClick={onOpen} sx={chipSx(true)} />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{ sx: popoverPaperSx }}
      >
        <Typography variant="caption" color="text.secondary" sx={sectionLabelSx}>
          Material
        </Typography>
        <ToggleButtonGroup value={material} exclusive onChange={handleChange} size="small">
          {MATERIAL_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value} sx={toggleButtonSx}>
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Popover>
    </>
  );
};

export const SizeChipControl = () => {
  const dispatch = useDispatch();
  const settings = useSelector((s: RootState) => s.cadState.cadGenerationSettings);
  const size = settings.approximate_size ?? { width: null, depth: null, height: null };
  const { anchorEl, open, onOpen, onClose } = useAnchor();
  const isSet = size.width != null || size.depth != null || size.height != null;
  const label = isSet
    ? `${size.width ?? '—'}×${size.depth ?? '—'}×${size.height ?? '—'} mm`
    : 'Size: —';

  const handleChange = (dim: 'width' | 'depth' | 'height') => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const val = e.target.value === '' ? null : Number(e.target.value);
    const newSize = { ...size, [dim]: val };
    const allNull = newSize.width === null && newSize.depth === null && newSize.height === null;
    dispatch(setCadGenerationSettings({ settings: { approximate_size: allNull ? null : newSize } }));
  };

  return (
    <>
      <Chip label={label} size="small" variant="outlined" onClick={onOpen} sx={chipSx(isSet)} />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{ sx: popoverPaperSx }}
      >
        <Typography variant="caption" color="text.secondary" sx={sectionLabelSx}>
          Approximate Size (mm)
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            type="number"
            size="small"
            placeholder="W"
            value={size.width ?? ''}
            onChange={handleChange('width')}
            sx={{ width: 80 }}
            inputProps={{ min: 0, step: 1, style: { fontFamily: monoFontFamily } }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            &times;
          </Typography>
          <TextField
            type="number"
            size="small"
            placeholder="D"
            value={size.depth ?? ''}
            onChange={handleChange('depth')}
            sx={{ width: 80 }}
            inputProps={{ min: 0, step: 1, style: { fontFamily: monoFontFamily } }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            &times;
          </Typography>
          <TextField
            type="number"
            size="small"
            placeholder="H"
            value={size.height ?? ''}
            onChange={handleChange('height')}
            sx={{ width: 80 }}
            inputProps={{ min: 0, step: 1, style: { fontFamily: monoFontFamily } }}
          />
        </Box>
      </Popover>
    </>
  );
};

export const AdvancedSettingsButton = () => {
  const dispatch = useDispatch();
  const settings = useSelector((s: RootState) => s.cadState.cadGenerationSettings);
  const { anchorEl, open, onOpen, onClose } = useAnchor();

  const handleIterations = (_: Event, value: number | number[]) => {
    if (typeof value === 'number')
      dispatch(setCadGenerationSettings({ settings: { max_iterations: value } }));
  };
  const handleTimeout = (_: Event, value: number | number[]) => {
    if (typeof value === 'number')
      dispatch(setCadGenerationSettings({ settings: { timeout_seconds: value } }));
  };
  const handleUnits = (e: SelectChangeEvent) => {
    dispatch(setCadGenerationSettings({ settings: { target_units: e.target.value } }));
  };
  const handleFeatureToggle = (feature: string) => (
    _: React.ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => {
    const updated = checked
      ? [...settings.features, feature]
      : settings.features.filter((f) => f !== feature);
    dispatch(setCadGenerationSettings({ settings: { features: updated } }));
  };

  return (
    <>
      <IconButton size="small" onClick={onOpen} sx={{ color: 'primary.main', p: 0.25 }}>
        <TuneIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { ...popoverPaperSx, minWidth: 280 } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Design features
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
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

          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Max retry attempts: {settings.max_iterations}
            </Typography>
            <Slider
              value={settings.max_iterations}
              onChange={handleIterations}
              min={1}
              max={5}
              step={1}
              marks
              size="small"
            />
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Execution timeout: {settings.timeout_seconds}s
            </Typography>
            <Slider
              value={settings.timeout_seconds}
              onChange={handleTimeout}
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

          <FormControl size="small" fullWidth>
            <InputLabel>Units</InputLabel>
            <Select value={settings.target_units} label="Units" onChange={handleUnits}>
              <MenuItem value="mm">Millimeters (mm)</MenuItem>
              <MenuItem value="inches">Inches</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Popover>
    </>
  );
};
