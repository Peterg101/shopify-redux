import { useState } from 'react';
import { Box, Typography, Divider, ToggleButtonGroup, ToggleButton } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import { DropArea } from './dropArea';
import AiTextPrompt from './aiTextPrompt';
import AiCadPrompt from './aiCadPrompt';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import MeshyLoading from './meshyLoading';
import CadLoading from './cadLoading';
import { glowMedium, borderSubtle, borderHover, glowSubtle } from '../../theme';

type GenerationMode = 'mesh' | 'cad';

export const Dropzone = () => {
  const meshyState = useSelector((state: RootState) => state.meshyState);
  const cadState = useSelector((state: RootState) => state.cadState);
  const [mode, setMode] = useState<GenerationMode>('mesh');

  const isMeshyGenerating = meshyState.meshyPending || meshyState.meshyLoading;
  const isCadGenerating = cadState.cadPending || cadState.cadLoading || Boolean(cadState.cadError);
  const isGenerating = isMeshyGenerating || isCadGenerating;

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: GenerationMode | null) => {
    if (newMode) setMode(newMode);
  };

  const renderLoadingArea = () => {
    if (isMeshyGenerating) return <MeshyLoading />;
    if (isCadGenerating) return <CadLoading />;
    return <DropArea />;
  };

  return (
    <Box
      sx={{
        border: `1px solid ${glowMedium}`,
        borderRadius: 3,
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: borderHover,
          boxShadow: `0 0 20px ${glowSubtle}`,
        },
      }}
    >
      {/* Upload / Loading Area */}
      <Box sx={{ p: 3 }}>
        {isGenerating ? renderLoadingArea() : <DropArea />}
      </Box>

      {/* OR Divider */}
      <Box sx={{ px: 4, py: 1 }}>
        <Divider sx={{ borderColor: borderSubtle }}>
          <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
            OR
          </Typography>
        </Divider>
      </Box>

      {/* AI Generation Area */}
      <Box sx={{ p: 4 }}>
        {/* Mode Toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            onChange={handleModeChange}
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                px: 2,
                py: 0.5,
                fontSize: '0.85rem',
                borderColor: borderSubtle,
                '&.Mui-selected': {
                  bgcolor: borderSubtle,
                  color: 'primary.main',
                  borderColor: borderHover,
                },
              },
            }}
          >
            <ToggleButton value="mesh">
              <AutoAwesomeIcon sx={{ fontSize: 16, mr: 0.5 }} />
              Mesh (Meshy)
            </ToggleButton>
            <ToggleButton value="cad">
              <PrecisionManufacturingIcon sx={{ fontSize: 16, mr: 0.5 }} />
              CAD (Claude)
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {mode === 'mesh' ? <AiTextPrompt /> : <AiCadPrompt />}
      </Box>
    </Box>
  );
};
