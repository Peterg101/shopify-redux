import { Box, Typography, Divider } from '@mui/material';
import { DropArea } from './dropArea';
import AiTextPrompt from './aiTextPrompt';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import MeshyLoading from './meshyLoading';

export const Dropzone = () => {
  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
  );

  const isGenerating = userInterfaceState.meshyPending || userInterfaceState.meshyLoading;

  return (
    <Box
      sx={{
        border: '1px solid rgba(0, 229, 255, 0.15)',
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: 'rgba(0, 229, 255, 0.3)',
          boxShadow: '0 0 20px rgba(0, 229, 255, 0.08)',
        },
      }}
    >
      {/* Upload / Loading Area */}
      <Box sx={{ p: 2 }}>
        {isGenerating ? <MeshyLoading /> : <DropArea />}
      </Box>

      {/* OR Divider */}
      <Box sx={{ px: 3 }}>
        <Divider sx={{ borderColor: 'rgba(0, 229, 255, 0.12)' }}>
          <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
            OR
          </Typography>
        </Divider>
      </Box>

      {/* AI Prompt Area */}
      <Box sx={{ p: 3 }}>
        <AiTextPrompt />
      </Box>
    </Box>
  );
};
