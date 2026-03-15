import { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  IconButton,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  ExpandMore,
  Settings,
  Build,
  Palette,
  Tune,
  ShoppingCart,
  Add,
  Remove,
} from '@mui/icons-material';
import { SelectChangeEvent } from '@mui/material/Select';
import { Part, ManufacturingProcess, ManufacturingMaterial } from '../../app/utility/interfaces';
import { useGetManufacturingProcessesQuery, useGetManufacturingMaterialsQuery } from '../../services/dbApi';
import { useOrderFromPartMutation } from '../../services/catalogApi';
import { isCadFileType } from '../../services/fetchFileUtils';
import { monoFontFamily } from '../../theme';

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

const colours = ['red', 'blue', 'green', 'orange', 'purple', 'black', 'white', 'grey'];

interface PartConfigSidebarProps {
  part: Part;
  onColourChange: (colour: string) => void;
}

export const PartConfigSidebar = ({ part, onColourChange }: PartConfigSidebarProps) => {
  const isCad = isCadFileType(part.file_type);

  // Local state
  const [technique, setTechnique] = useState(part.recommended_process ?? '');
  const [material, setMaterial] = useState(part.recommended_material ?? '');
  const [colour, setColour] = useState('white');
  const [quantity, setQuantity] = useState(1);
  const [toleranceMm, setToleranceMm] = useState<number | undefined>(undefined);
  const [surfaceFinish, setSurfaceFinish] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Server data
  const { data: serverProcesses } = useGetManufacturingProcessesQuery();
  const { data: serverMaterials } = useGetManufacturingMaterialsQuery();
  const [orderFromPart, { isLoading }] = useOrderFromPartMutation();

  // Filter processes: CAD sees all, OBJ/STL sees only 3D printing
  const filteredProcesses = serverProcesses
    ? isCad
      ? serverProcesses
      : serverProcesses.filter((p: ManufacturingProcess) => p.family === '3d_printing')
    : null;

  const techniqueOptions = filteredProcesses
    ? filteredProcesses.map((p: ManufacturingProcess) => p.name)
    : [];

  // Filter materials by selected process's family
  const selectedProcess = serverProcesses?.find(
    (p: ManufacturingProcess) => p.name === technique
  );
  const materialOptions = serverMaterials && selectedProcess
    ? serverMaterials.filter(
        (m: ManufacturingMaterial) => m.process_family === selectedProcess.family
      )
    : [];

  const handleTechniqueChange = (event: SelectChangeEvent) => {
    setTechnique(event.target.value);
    setMaterial(''); // Reset material when technique changes
  };

  const handleMaterialChange = (event: SelectChangeEvent) => {
    setMaterial(event.target.value);
  };

  const handleColourChange = (event: SelectChangeEvent) => {
    const newColour = event.target.value;
    setColour(newColour);
    onColourChange(newColour);
  };

  const handleSubmit = async () => {
    if (quantity < 1) {
      setError('Quantity must be at least 1');
      return;
    }
    setError(null);

    try {
      await orderFromPart({
        partId: part.id,
        config: {
          material: material || undefined,
          technique: technique || undefined,
          quantity,
          colour,
          sizing: 1.0,
          tolerance_mm: toleranceMm,
          surface_finish: surfaceFinish,
        },
      }).unwrap();
      setSuccess(true);
    } catch (err: any) {
      setError(err?.data?.detail ?? 'Failed to add to basket');
    }
  };

  return (
    <Box
      sx={{
        width: 360,
        flexShrink: 0,
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        height: '100%',
        overflow: 'auto',
        backgroundColor: 'rgba(19, 25, 32, 0.95)',
        backdropFilter: 'blur(8px)',
        borderLeft: '1px solid rgba(0, 229, 255, 0.12)',
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
          Configure Order
        </Typography>
      </Box>

      <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
        {/* Process & Material */}
        <Accordion defaultExpanded sx={sectionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={summaryLabelSx}>
              <Build sx={{ color: 'primary.main', fontSize: 18 }} />
              <Typography variant="body1" fontWeight={500}>Process & Material</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel id="part-technique-label">Process</InputLabel>
              <Select
                labelId="part-technique-label"
                value={technique}
                label="Process"
                onChange={handleTechniqueChange}
              >
                {techniqueOptions.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel id="part-material-label">Material</InputLabel>
              <Select
                labelId="part-material-label"
                value={material}
                label="Material"
                onChange={handleMaterialChange}
              >
                {materialOptions.map((m: ManufacturingMaterial) => (
                  <MenuItem key={m.id} value={m.name}>{m.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* File type info chip */}
            <Box sx={{ mt: 1 }}>
              <Chip
                size="small"
                label={isCad ? 'CAD model — all manufacturing techniques' : '3D printing only'}
                sx={{
                  backgroundColor: isCad ? 'rgba(0, 229, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                  color: isCad ? 'primary.main' : 'text.secondary',
                  fontSize: '0.7rem',
                }}
              />
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Colour & Quantity */}
        <Accordion defaultExpanded sx={sectionSx}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={summaryLabelSx}>
              <Palette sx={{ color: 'primary.main', fontSize: 18 }} />
              <Typography variant="body1" fontWeight={500}>Colour & Quantity</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel id="part-colour-label">Colour</InputLabel>
              <Select
                labelId="part-colour-label"
                value={colour}
                label="Colour"
                onChange={handleColourChange}
              >
                {colours.map((c) => (
                  <MenuItem key={c} value={c}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 14, height: 14, borderRadius: '50%',
                        backgroundColor: c, border: '1px solid rgba(255,255,255,0.2)',
                      }} />
                      {c}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>Qty:</Typography>
              <IconButton
                size="small"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                sx={{ border: '1px solid rgba(0, 229, 255, 0.2)' }}
              >
                <Remove sx={{ fontSize: 16 }} />
              </IconButton>
              <Typography variant="body1" sx={{ fontFamily: monoFontFamily, minWidth: 32, textAlign: 'center' }}>
                {quantity}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setQuantity(quantity + 1)}
                sx={{ border: '1px solid rgba(0, 229, 255, 0.2)' }}
              >
                <Add sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
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
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel id="part-tolerance-label">Tolerance</InputLabel>
                <Select
                  labelId="part-tolerance-label"
                  value={toleranceMm != null ? String(toleranceMm) : ''}
                  label="Tolerance"
                  onChange={(e: SelectChangeEvent) => {
                    const val = e.target.value;
                    setToleranceMm(val ? parseFloat(val) : undefined);
                  }}
                >
                  <MenuItem value="0.5">0.5 mm — Standard</MenuItem>
                  <MenuItem value="0.2">0.2 mm — Precision</MenuItem>
                  <MenuItem value="0.1">0.1 mm — High</MenuItem>
                  <MenuItem value="0.05">0.05 mm — Ultra</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel id="part-surface-label">Surface Finish</InputLabel>
                <Select
                  labelId="part-surface-label"
                  value={surfaceFinish ?? ''}
                  label="Surface Finish"
                  onChange={(e: SelectChangeEvent) => {
                    const val = e.target.value;
                    setSurfaceFinish(val || undefined);
                  }}
                >
                  <MenuItem value="As Machined">As Machined</MenuItem>
                  <MenuItem value="Smooth">Smooth</MenuItem>
                  <MenuItem value="Polished">Polished</MenuItem>
                  <MenuItem value="Bead Blasted">Bead Blasted</MenuItem>
                  <MenuItem value="Anodized">Anodized</MenuItem>
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                {toleranceMm != null && (
                  <Chip label={`\u00b1${toleranceMm} mm`} size="small" variant="outlined" />
                )}
                {surfaceFinish && (
                  <Chip label={surfaceFinish} size="small" variant="outlined" />
                )}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Geometry (read-only) */}
        {(part.bounding_box_x || part.volume_cm3) && (
          <Box
            sx={{
              border: '1px solid rgba(0, 229, 255, 0.12)',
              borderRadius: 2,
              p: 2,
              mt: 1,
            }}
          >
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
              Geometry
            </Typography>
            {part.bounding_box_x != null && (
              <Typography variant="body2" sx={{ fontFamily: monoFontFamily, fontSize: '0.8rem' }}>
                Bounding Box: {part.bounding_box_x} × {part.bounding_box_y} × {part.bounding_box_z} mm
              </Typography>
            )}
            {part.volume_cm3 != null && (
              <Typography variant="body2" sx={{ fontFamily: monoFontFamily, fontSize: '0.8rem' }}>
                Volume: {part.volume_cm3} cm³
              </Typography>
            )}
            {part.surface_area_cm2 != null && (
              <Typography variant="body2" sx={{ fontFamily: monoFontFamily, fontSize: '0.8rem' }}>
                Surface Area: {part.surface_area_cm2} cm²
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Sticky Add to Basket button */}
      <Box sx={{ p: 2, borderTop: '1px solid rgba(0, 229, 255, 0.12)' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1, fontSize: '0.8rem' }}>
            {error}
          </Alert>
        )}
        <Button
          variant="contained"
          fullWidth
          startIcon={<ShoppingCart />}
          onClick={handleSubmit}
          disabled={isLoading}
          sx={{ py: 1.2 }}
        >
          {isLoading ? 'Adding...' : 'Add to Basket'}
        </Button>
      </Box>

      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        message="Added to basket"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};
