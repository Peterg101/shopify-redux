import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Input as MuiInput,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import {
  ExpandMore,
  Settings,
  Palette,
  Straighten,
  HighQuality,
  ThreeDRotation,
  Build,
} from '@mui/icons-material';
import { SelectChangeEvent } from '@mui/material/Select';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import {
  setPrintMaterial,
  setPrintTechnique,
  setModelColour,
  setMultiplierValue,
  setQALevel,
  setXFLip,
  setYFLip,
  setZFLip,
} from '../../services/dataSlice';
import { PricingConfig } from '../../app/utility/interfaces';
import pricingConfig from '../../config/pricingConfig.json';
import { getPrice, degreesToRadians } from '../../app/utility/utils';
import { monoFontFamily } from '../../theme';

const config: PricingConfig = pricingConfig;

const sectionSx = {
  backgroundColor: 'transparent',
  backgroundImage: 'none',
  boxShadow: 'none',
  '&:before': { display: 'none' },
  border: '1px solid rgba(0, 229, 255, 0.12)',
  borderRadius: '8px !important',
  mb: 1,
  '&.Mui-expanded': { mb: 1 },
};

const summaryLabelSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

export const ConfigurationPanel = () => {
  const dispatch = useDispatch();
  const dataState = useSelector((state: RootState) => state.dataState);
  const [xValue, setXValue] = useState(0);
  const [yValue, setYValue] = useState(0);
  const [zValue, setZValue] = useState(0);

  const { techniques, materials } = config;

  const colours = ['red', 'blue', 'green', 'orange', 'purple', 'black', 'white', 'grey'];

  const defaultQAProfiles: Record<string, { dimensionalTolerance: string; photoEvidence: string; surfaceFinish: string }> = {
    standard: { dimensionalTolerance: '\u00b10.5mm', photoEvidence: 'No', surfaceFinish: 'Standard' },
    high: { dimensionalTolerance: '\u00b10.2mm', photoEvidence: 'Yes', surfaceFinish: 'Smooth' },
  };
  const currentProfile = defaultQAProfiles[dataState.qaLevel];

  // Material handlers
  const handleTechniqueChange = (event: SelectChangeEvent) => {
    dispatch(setPrintTechnique({ printTechnique: event.target.value }));
  };
  const handleMaterialChange = (event: SelectChangeEvent) => {
    const printMaterial = event.target.value;
    const materialCost = getPrice(printMaterial, config);
    dispatch(setPrintMaterial({ printMaterial, materialCost }));
  };
  const handleColourChange = (event: SelectChangeEvent) => {
    dispatch(setModelColour({ modelColour: event.target.value }));
  };

  // Sizing handlers
  const handleSizeSlider = (_event: Event, newValue: number | number[]) => {
    if (typeof newValue === 'number') dispatch(setMultiplierValue({ multiplierValue: newValue }));
  };
  const handleSizeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(event.target.value);
    if (v >= dataState.minScale && v <= dataState.maxScale) dispatch(setMultiplierValue({ multiplierValue: v }));
  };
  const handleSizeBlur = () => {
    if (dataState.multiplierValue > dataState.maxScale) dispatch(setMultiplierValue({ multiplierValue: dataState.maxScale }));
    if (dataState.multiplierValue < dataState.minScale) dispatch(setMultiplierValue({ multiplierValue: dataState.minScale }));
  };

  // QA handler
  const handleQAChange = (event: SelectChangeEvent) => {
    dispatch(setQALevel({ qaLevel: event.target.value as 'standard' | 'high' }));
  };

  // Orientation handlers
  const handleXChange = (_e: Event, v: number | number[]) => {
    if (typeof v === 'number') { dispatch(setXFLip({ xFlip: degreesToRadians(v) })); setXValue(v); }
  };
  const handleYChange = (_e: Event, v: number | number[]) => {
    if (typeof v === 'number') { dispatch(setYFLip({ yFlip: degreesToRadians(v) })); setYValue(v); }
  };
  const handleZChange = (_e: Event, v: number | number[]) => {
    if (typeof v === 'number') { dispatch(setZFLip({ zFlip: degreesToRadians(v) })); setZValue(v); }
  };

  const marks = [
    { value: dataState.minScale, label: String(dataState.minScale) },
    { value: 1 },
    { value: dataState.maxScale, label: String(dataState.maxScale) },
  ];

  return (
    <Box
      sx={{
        mt: 2,
        border: '1px solid rgba(0, 229, 255, 0.12)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: '1px solid rgba(0, 229, 255, 0.12)',
          backgroundColor: 'rgba(0, 229, 255, 0.04)',
        }}
      >
        <Settings sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={600}>
          Configuration
        </Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        {/* Technique, Material & Colour */}
        <Accordion defaultExpanded sx={sectionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={summaryLabelSx}>
              <Build sx={{ color: 'primary.main', fontSize: 18 }} />
              <Typography variant="body1" fontWeight={500}>Technique, Material & Colour</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel id="cfg-technique-label">Technique</InputLabel>
                  <Select
                    labelId="cfg-technique-label"
                    value={dataState.printTechnique}
                    label="Technique"
                    onChange={handleTechniqueChange}
                  >
                    {techniques.map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel id="cfg-material-label">Material</InputLabel>
                  <Select
                    labelId="cfg-material-label"
                    value={dataState.printMaterial}
                    label="Material"
                    onChange={handleMaterialChange}
                  >
                    {materials[dataState.printTechnique]?.map((m) => (
                      <MenuItem key={m.name} value={m.name}>{m.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel id="cfg-colour-label">Colour</InputLabel>
                  <Select
                    labelId="cfg-colour-label"
                    value={dataState.modelColour}
                    label="Colour"
                    onChange={handleColourChange}
                  >
                    {colours.map((c) => (
                      <MenuItem key={c} value={c}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            backgroundColor: c,
                            border: '1px solid rgba(255,255,255,0.2)',
                          }} />
                          {c}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            {/* Active chips summary */}
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              {dataState.printTechnique && <Chip label={dataState.printTechnique} size="small" variant="outlined" />}
              {dataState.printMaterial && <Chip label={dataState.printMaterial} size="small" variant="outlined" />}
              {dataState.modelColour && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={dataState.modelColour}
                  icon={<Palette sx={{ fontSize: 14 }} />}
                />
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Scale & Dimensions */}
        <Accordion defaultExpanded sx={sectionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={summaryLabelSx}>
              <Straighten sx={{ color: 'primary.main', fontSize: 18 }} />
              <Typography variant="body1" fontWeight={500}>Scale & Dimensions</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={7}>
                <Box sx={{ px: 1 }}>
                  <Slider
                    aria-label="Model scale"
                    value={dataState.multiplierValue}
                    onChange={handleSizeSlider}
                    marks={marks}
                    min={dataState.minScale}
                    step={0.01}
                    max={dataState.maxScale}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">Scale:</Typography>
                    <MuiInput
                      value={dataState.multiplierValue}
                      size="small"
                      onChange={handleSizeInput}
                      onBlur={handleSizeBlur}
                      inputProps={{
                        step: 0.01,
                        min: dataState.minScale,
                        max: dataState.maxScale,
                        type: 'number',
                        'aria-label': 'Model scale value',
                      }}
                      sx={{ width: 70, fontFamily: monoFontFamily }}
                    />
                    <Typography variant="body2" sx={{ fontFamily: monoFontFamily }}>x</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={5}>
                <TableContainer component={Paper} sx={{ boxShadow: 'none', backgroundColor: 'transparent', border: '1px solid rgba(0, 229, 255, 0.12)' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontFamily: monoFontFamily, fontSize: '0.75rem' }}>Vol (cm\u00b3)</TableCell>
                        <TableCell align="right" sx={{ fontFamily: monoFontFamily, fontSize: '0.75rem' }}>X</TableCell>
                        <TableCell align="right" sx={{ fontFamily: monoFontFamily, fontSize: '0.75rem' }}>Y</TableCell>
                        <TableCell align="right" sx={{ fontFamily: monoFontFamily, fontSize: '0.75rem' }}>Z</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontFamily: monoFontFamily, fontSize: '0.75rem' }}>
                          {(dataState.modelVolume * 0.01).toFixed(1)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: monoFontFamily, fontSize: '0.75rem' }}>
                          {dataState.modelDimensions ? (dataState.modelDimensions.position.x / 10).toFixed(1) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: monoFontFamily, fontSize: '0.75rem' }}>
                          {dataState.modelDimensions ? (dataState.modelDimensions.position.y / 10).toFixed(1) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: monoFontFamily, fontSize: '0.75rem' }}>
                          {dataState.modelDimensions ? (dataState.modelDimensions.position.z / 10).toFixed(1) : '-'}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Quality */}
        <Accordion sx={sectionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={summaryLabelSx}>
              <HighQuality sx={{ color: 'primary.main', fontSize: 18 }} />
              <Typography variant="body1" fontWeight={500}>Quality</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel id="cfg-qa-label">QA Level</InputLabel>
                  <Select
                    labelId="cfg-qa-label"
                    value={dataState.qaLevel}
                    label="QA Level"
                    onChange={handleQAChange}
                  >
                    <MenuItem value="standard">Standard</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip label={`Tolerance: ${currentProfile.dimensionalTolerance}`} size="small" variant="outlined" />
                  <Chip label={`Photos: ${currentProfile.photoEvidence}`} size="small" variant="outlined" />
                  <Chip label={`Finish: ${currentProfile.surfaceFinish}`} size="small" variant="outlined" />
                </Box>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Orientation */}
        <Accordion sx={sectionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={summaryLabelSx}>
              <ThreeDRotation sx={{ color: 'primary.main', fontSize: 18 }} />
              <Typography variant="body1" fontWeight={500}>Orientation</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  X: {xValue}\u00b0
                </Typography>
                <Slider
                  aria-label="X axis rotation"
                  value={xValue}
                  onChange={handleXChange}
                  min={-180} step={1} max={180}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Y: {yValue}\u00b0
                </Typography>
                <Slider
                  aria-label="Y axis rotation"
                  value={yValue}
                  onChange={handleYChange}
                  min={-180} step={1} max={180}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Z: {zValue}\u00b0
                </Typography>
                <Slider
                  aria-label="Z axis rotation"
                  value={zValue}
                  onChange={handleZChange}
                  min={-180} step={1} max={180}
                  size="small"
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  );
};
