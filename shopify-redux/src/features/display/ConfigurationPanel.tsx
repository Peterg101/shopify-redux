import React, { useMemo } from 'react';
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
  Build,
  Tune,
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
  setProcessId,
  setMaterialId,
  setProcessFamily,
  setToleranceMm,
  setSurfaceFinish,
} from '../../services/dataSlice';
import { PricingConfig, ManufacturingProcess, ManufacturingMaterial } from '../../app/utility/interfaces';
import pricingConfig from '../../config/pricingConfig.json';
import { getPrice } from '../../app/utility/utils';
import { useGetManufacturingProcessesQuery, useGetManufacturingMaterialsQuery } from '../../services/dbApi';
import { monoFontFamily, borderSubtle, bgHighlight, glowSubtle } from '../../theme';
import { isCadFileType } from '../../services/fetchFileUtils';

const config: PricingConfig = pricingConfig;

const sectionSx = {
  backgroundColor: 'transparent',
  backgroundImage: 'none',
  boxShadow: 'none',
  '&:before': { display: 'none' },
  border: `1px solid ${borderSubtle}`,
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

  // Server-driven manufacturing taxonomy (with pricingConfig fallback)
  const { data: serverProcesses } = useGetManufacturingProcessesQuery();
  const { data: serverMaterials } = useGetManufacturingMaterialsQuery();

  // Determine if the current file is a CAD model
  const isCad = isCadFileType(dataState.selectedFileType);

  // Filter processes: CAD files see all processes, Meshy files see only 3D printing
  const filteredProcesses = useMemo(
    () =>
      serverProcesses
        ? isCad
          ? serverProcesses
          : serverProcesses.filter((p: ManufacturingProcess) => p.family === '3d_printing')
        : null,
    [serverProcesses, isCad]
  );

  // Derive technique list: use server data if available, else static config
  const { techniques, materials } = config;
  const techniqueOptions: string[] = useMemo(
    () =>
      filteredProcesses
        ? filteredProcesses.map((p: ManufacturingProcess) => p.name)
        : techniques,
    [filteredProcesses, techniques]
  );

  // Filter materials by the selected process's family
  const selectedProcess = serverProcesses?.find(
    (p: ManufacturingProcess) => p.name === dataState.printTechnique
  );
  const materialOptions = useMemo(
    () =>
      serverMaterials && selectedProcess
        ? serverMaterials.filter(
            (m: ManufacturingMaterial) => m.process_family === selectedProcess.family
          )
        : null,
    [serverMaterials, selectedProcess]
  );

  const colours = ['red', 'blue', 'green', 'orange', 'purple', 'black', 'white', 'grey'];

  const defaultQAProfiles: Record<string, { dimensionalTolerance: string; photoEvidence: string; surfaceFinish: string }> = {
    standard: { dimensionalTolerance: '\u00b10.5mm', photoEvidence: 'No', surfaceFinish: 'Standard' },
    high: { dimensionalTolerance: '\u00b10.2mm', photoEvidence: 'Yes', surfaceFinish: 'Smooth' },
  };
  const currentProfile = defaultQAProfiles[dataState.qaLevel];

  // Material handlers
  const handleTechniqueChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    dispatch(setPrintTechnique({ printTechnique: value }));
    // Set process_id and family from server data
    const proc = serverProcesses?.find((p: ManufacturingProcess) => p.name === value);
    dispatch(setProcessId({ processId: proc?.id ?? null }));
    dispatch(setProcessFamily({ processFamily: proc?.family ?? null }));
    // Reset material when technique changes
    dispatch(setMaterialId({ materialId: null }));
  };
  const handleMaterialChange = (event: SelectChangeEvent) => {
    const printMaterial = event.target.value;
    const materialCost = getPrice(printMaterial, config);
    dispatch(setPrintMaterial({ printMaterial, materialCost }));
    // Set material_id from server data
    const mat = serverMaterials?.find((m: ManufacturingMaterial) => m.name === printMaterial);
    dispatch(setMaterialId({ materialId: mat?.id ?? null }));
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

  // Manufacturing spec handlers (CAD only)
  const handleToleranceChange = (event: SelectChangeEvent) => {
    const val = event.target.value;
    dispatch(setToleranceMm({ toleranceMm: val ? parseFloat(val) : undefined }));
  };
  const handleSurfaceFinishChange = (event: SelectChangeEvent) => {
    const val = event.target.value;
    dispatch(setSurfaceFinish({ surfaceFinish: val || undefined }));
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
        border: `1px solid ${borderSubtle}`,
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
          borderBottom: `1px solid ${borderSubtle}`,
          backgroundColor: bgHighlight,
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
                    {techniqueOptions.map((t) => (
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
                    {materialOptions
                      ? materialOptions.map((m: ManufacturingMaterial) => (
                          <MenuItem key={m.id} value={m.name}>{m.name}</MenuItem>
                        ))
                      : materials[dataState.printTechnique]?.map((m) => (
                          <MenuItem key={m.name} value={m.name}>{m.name}</MenuItem>
                        ))
                    }
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
            {/* File type info chip */}
            {dataState.selectedFileType && (
              <Box sx={{ mt: 1 }}>
                <Chip
                  size="small"
                  label={isCad ? 'CAD model — all manufacturing techniques' : '3D printing only'}
                  sx={{
                    backgroundColor: isCad ? glowSubtle : 'rgba(255, 255, 255, 0.05)',
                    color: isCad ? 'primary.main' : 'text.secondary',
                    fontSize: '0.7rem',
                  }}
                />
              </Box>
            )}
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
                <TableContainer component={Paper} sx={{ boxShadow: 'none', backgroundColor: 'transparent', border: `1px solid ${borderSubtle}` }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontFamily: monoFontFamily, fontSize: '0.75rem' }}>Vol (cm³)</TableCell>
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

        {/* Manufacturing Specs (CAD only) */}
        {isCad && (
          <Accordion sx={sectionSx}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={summaryLabelSx}>
                <Tune sx={{ color: 'primary.main', fontSize: 18 }} />
                <Typography variant="body1" fontWeight={500}>Manufacturing Specs</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="cfg-tolerance-label">Tolerance</InputLabel>
                    <Select
                      labelId="cfg-tolerance-label"
                      value={dataState.toleranceMm != null ? String(dataState.toleranceMm) : ''}
                      label="Tolerance"
                      onChange={handleToleranceChange}
                    >
                      <MenuItem value="0.5">0.5 mm — Standard</MenuItem>
                      <MenuItem value="0.2">0.2 mm — Precision</MenuItem>
                      <MenuItem value="0.1">0.1 mm — High</MenuItem>
                      <MenuItem value="0.05">0.05 mm — Ultra</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="cfg-surface-label">Surface Finish</InputLabel>
                    <Select
                      labelId="cfg-surface-label"
                      value={dataState.surfaceFinish ?? ''}
                      label="Surface Finish"
                      onChange={handleSurfaceFinishChange}
                    >
                      <MenuItem value="As Machined">As Machined</MenuItem>
                      <MenuItem value="Smooth">Smooth</MenuItem>
                      <MenuItem value="Polished">Polished</MenuItem>
                      <MenuItem value="Bead Blasted">Bead Blasted</MenuItem>
                      <MenuItem value="Anodized">Anodized</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                {dataState.toleranceMm != null && (
                  <Chip label={`±${dataState.toleranceMm} mm`} size="small" variant="outlined" />
                )}
                {dataState.surfaceFinish && (
                  <Chip label={dataState.surfaceFinish} size="small" variant="outlined" />
                )}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

      </Box>
    </Box>
  );
};
