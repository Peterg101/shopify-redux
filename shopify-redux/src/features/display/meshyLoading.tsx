import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { keyframes } from '@mui/material/styles';
import { monoFontFamily, glowMedium, bgHighlightHover, borderHover } from '../../theme';

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 20px ${glowMedium}; }
  50% { box-shadow: 0 0 40px ${borderHover}; }
`;

const MeshyLoading = () => {
  const meshyState = useSelector((state: RootState) => state.meshyState);

  const isLoading = meshyState.meshyLoading;
  const isPending = meshyState.meshyPending;
  const percentage = meshyState.meshyLoadedPercentage;

  return (
    <Box
      sx={{
        border: `1px solid ${glowMedium}`,
        borderRadius: 2,
        height: { xs: '300px', md: '500px' },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2,
        animation: `${pulseGlow} 2s ease-in-out infinite`,
      }}
    >
      <AutoAwesomeIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.6 }} />

      <Typography variant="h6" color="text.primary" fontWeight={600}>
        Generating your model...
      </Typography>

      {isLoading && isPending && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HourglassEmptyIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
          <Typography variant="body2" color="text.secondary">
            Position in queue: {meshyState.meshyQueueItems}
          </Typography>
        </Box>
      )}

      {isLoading && !isPending && (
        <Box sx={{ width: '60%', maxWidth: 300, textAlign: 'center' }}>
          <Typography
            variant="h4"
            color="primary.main"
            fontWeight={700}
            sx={{ fontFamily: monoFontFamily, mb: 1 }}
          >
            {percentage}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={percentage}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: bgHighlightHover,
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default MeshyLoading;
