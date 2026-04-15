import { Box, Typography, Divider } from '@mui/material';
import { DropArea } from './dropArea';
import CadChat from './cadChat/CadChat';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import CadLoading from './cadLoading';
import { glowMedium, borderSubtle, borderHover, glowSubtle } from '../../theme';

export const Dropzone = () => {
  const cadState = useSelector((state: RootState) => state.cadState);

  const isCadGenerating = cadState.cadPending || cadState.cadLoading || Boolean(cadState.cadError);

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
