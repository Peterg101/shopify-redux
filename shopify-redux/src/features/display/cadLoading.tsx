import React from 'react';
import { Box, CircularProgress, LinearProgress, Typography, Alert } from '@mui/material';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { keyframes } from '@mui/material/styles';
import { monoFontFamily } from '../../theme';

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(0, 229, 255, 0.15); }
  50% { box-shadow: 0 0 40px rgba(0, 229, 255, 0.3); }
`;

const CadLoading = () => {
  const cadState = useSelector((state: RootState) => state.cadState);

  const isLoading = cadState.cadLoading;
  const percentage = cadState.cadLoadedPercentage;
  const statusMessage = cadState.cadStatusMessage;
  const error = cadState.cadError;

  if (error) {
    return (
      <Box
        sx={{
          border: '1px solid rgba(255, 82, 82, 0.3)',
          borderRadius: 2,
          height: { xs: '300px', md: '500px' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          p: 3,
        }}
      >
        <PrecisionManufacturingIcon sx={{ fontSize: 40, color: 'error.main', opacity: 0.6 }} />
        <Typography variant="h6" color="error.main" fontWeight={600}>
          Generation Failed
        </Typography>
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        border: '1px solid rgba(0, 229, 255, 0.15)',
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
      <PrecisionManufacturingIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.6 }} />

      <CircularProgress
        variant={isLoading ? 'determinate' : 'indeterminate'}
        value={percentage}
        size={80}
        thickness={3}
        sx={{ color: 'primary.main' }}
      />

      <Typography variant="h6" color="text.primary" fontWeight={600}>
        Generating CAD model...
      </Typography>

      {statusMessage && (
        <Typography variant="body2" color="text.secondary">
          {statusMessage}
        </Typography>
      )}

      {isLoading && (
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
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
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

export default CadLoading;
