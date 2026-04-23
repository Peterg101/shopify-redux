import { Box, Typography, Divider } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { DropArea } from './dropArea';
import CadChat from './cadChat/CadChat';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import CadLoading from './cadLoading';
import { glowMedium, borderSubtle, borderHover, glowSubtle, bgHighlight } from '../../theme';
import { FEATURES } from '../../config/featureFlags';

export const Dropzone = () => {
  const cadState = useSelector((state: RootState) => state.cadState);
  const chatState = useSelector((state: RootState) => state.cadChatState);

  const isCadGenerating = cadState.cadPending || cadState.cadLoading || Boolean(cadState.cadError);

  // Show task name when we have one — from spec, or from an active chat session
  const taskName = chatState.currentSpec?.part_name
    || chatState.currentSpec?.description
    || (chatState.taskId && chatState.phase !== 'idle' ? 'Draft design' : null);

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
      {/* Hero area — CAD-only launch messaging */}
      {!FEATURES.MANUFACTURING && !taskName && (
        <Box sx={{ px: 3, py: 3 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            From Idea to Engineering-Grade 3D Model
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Describe your part. Chat with our AI engineer.
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Get a STEP file ready for 3D printing or CNC.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
            Coming soon: order physical parts directly.
          </Typography>
        </Box>
      )}

      {/* Task name header — visible when chat has context */}
      {taskName && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 3,
            py: 1.5,
            borderBottom: `1px solid ${borderSubtle}`,
            backgroundColor: bgHighlight,
          }}
        >
          <SmartToyIcon sx={{ fontSize: 16, color: 'primary.main' }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ color: 'primary.main' }}>
            {taskName}
          </Typography>
        </Box>
      )}

      <Box sx={{ p: 3 }}>
        {isCadGenerating ? <CadLoading /> : <DropArea />}
      </Box>

      <Box sx={{ px: 4, py: 1 }}>
        <Divider sx={{ borderColor: borderSubtle }}>
          <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
            OR
          </Typography>
        </Divider>
      </Box>

      <Box sx={{ p: 4 }}>
        <CadChat />
      </Box>
    </Box>
  );
};
