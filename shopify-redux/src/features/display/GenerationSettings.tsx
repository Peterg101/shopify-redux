import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Input as MuiInput,
  TextField,
  Divider,
  FormControlLabel,
  Switch,
  SelectChangeEvent,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TuneIcon from '@mui/icons-material/Tune';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../app/store';
import { setMeshyGenerationSettings } from '../../services/meshySlice';

interface GenerationSettingsProps {
  mode: 'text' | 'image';
}

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

export const GenerationSettings: React.FC<GenerationSettingsProps> = ({ mode }) => {
  const dispatch = useDispatch();
  const settings = useSelector(
    (state: RootState) => state.meshyState.meshyGenerationSettings
  );

  return (
    <Accordion defaultExpanded={false} sx={sectionSx}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={summaryLabelSx}>
          <TuneIcon sx={{ color: 'primary.main', fontSize: 18 }} />
          <Typography variant="body1" fontWeight={500}>
            Advanced Generation Settings
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={2}>
          {/* Row 1: AI Model + Art Style */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>AI Model</InputLabel>
              <Select
                value={settings.ai_model}
                label="AI Model"
                onChange={(e: SelectChangeEvent) =>
                  dispatch(setMeshyGenerationSettings({ settings: { ai_model: e.target.value } }))
                }
              >
                <MenuItem value="meshy-5">Meshy-5</MenuItem>
                <MenuItem value="meshy-6">Meshy-6</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Art Style</InputLabel>
              <Select
                value={settings.art_style}
                label="Art Style"
                onChange={(e: SelectChangeEvent) =>
                  dispatch(setMeshyGenerationSettings({ settings: { art_style: e.target.value } }))
                }
              >
                <MenuItem value="realistic">Realistic</MenuItem>
                <MenuItem value="cartoon">Cartoon</MenuItem>
                <MenuItem value="sculpture">Sculpture</MenuItem>
                <MenuItem value="pbr">PBR</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Row 2: Topology + Symmetry */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Topology</InputLabel>
              <Select
                value={settings.topology}
                label="Topology"
                onChange={(e: SelectChangeEvent) =>
                  dispatch(
                    setMeshyGenerationSettings({
                      settings: { topology: e.target.value as 'quad' | 'triangle' },
                    })
                  )
                }
              >
                <MenuItem value="triangle">Triangle</MenuItem>
                <MenuItem value="quad">Quad</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Symmetry</InputLabel>
              <Select
                value={settings.symmetry_mode}
                label="Symmetry"
                onChange={(e: SelectChangeEvent) =>
                  dispatch(
                    setMeshyGenerationSettings({
                      settings: { symmetry_mode: e.target.value as 'off' | 'auto' | 'on' },
                    })
                  )
                }
              >
                <MenuItem value="off">Off</MenuItem>
                <MenuItem value="auto">Auto</MenuItem>
                <MenuItem value="on">On</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Row 3: Polycount slider */}
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Target Polycount: {settings.target_polycount.toLocaleString()}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Slider
                value={settings.target_polycount}
                onChange={(_, val) =>
                  dispatch(
                    setMeshyGenerationSettings({ settings: { target_polycount: val as number } })
                  )
                }
                min={100}
                max={300000}
                step={1000}
                sx={{ flexGrow: 1 }}
              />
              <MuiInput
                value={settings.target_polycount}
                size="small"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 100 && val <= 300000) {
                    dispatch(
                      setMeshyGenerationSettings({ settings: { target_polycount: val } })
                    );
                  }
                }}
                inputProps={{ min: 100, max: 300000, type: 'number' }}
                sx={{ width: 90 }}
              />
            </Box>
          </Grid>

          {/* Row 4: Negative prompt */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label="Negative Prompt"
              value={settings.negative_prompt}
              onChange={(e) =>
                dispatch(
                  setMeshyGenerationSettings({ settings: { negative_prompt: e.target.value } })
                )
              }
            />
          </Grid>

          {/* Image-to-3D specific controls (only shown when mode='image') */}
          {mode === 'image' && (
            <>
              <Grid item xs={12}>
                <Divider sx={{ borderColor: 'rgba(0, 229, 255, 0.12)', my: 1 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Image-to-3D Options
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.enable_pbr}
                      onChange={(e) =>
                        dispatch(
                          setMeshyGenerationSettings({
                            settings: { enable_pbr: e.target.checked },
                          })
                        )
                      }
                      size="small"
                    />
                  }
                  label="Enable PBR"
                />
              </Grid>
              <Grid item xs={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.should_remesh}
                      onChange={(e) =>
                        dispatch(
                          setMeshyGenerationSettings({
                            settings: { should_remesh: e.target.checked },
                          })
                        )
                      }
                      size="small"
                    />
                  }
                  label="Remesh"
                />
              </Grid>
              <Grid item xs={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.should_texture}
                      onChange={(e) =>
                        dispatch(
                          setMeshyGenerationSettings({
                            settings: { should_texture: e.target.checked },
                          })
                        )
                      }
                      size="small"
                    />
                  }
                  label="Texture"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Texture Prompt"
                  value={settings.texture_prompt}
                  onChange={(e) =>
                    dispatch(
                      setMeshyGenerationSettings({
                        settings: { texture_prompt: e.target.value },
                      })
                    )
                  }
                />
              </Grid>
            </>
          )}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};

export default GenerationSettings;
