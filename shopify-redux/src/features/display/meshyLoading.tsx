import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { keyframes } from '@mui/system';

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(0, 229, 255, 0.2); }
  50% { box-shadow: 0 0 40px rgba(0, 229, 255, 0.4); }
`;

const MeshyLoading = () => {
  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
  )

  const isLoading = userInterfaceState.meshyLoading
  const isPending = userInterfaceState.meshyPending

  return (
    <Box
      sx={{
        border: '2px dashed',
        borderColor: 'rgba(0, 229, 255, 0.3)',
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
      <CircularProgress
        variant={(isLoading && !isPending) ? 'determinate' : 'indeterminate'}
        value={userInterfaceState.meshyLoadedPercentage}
        size={100}
        sx={{ color: 'primary.main' }}
      />
      {(isLoading && isPending) && (
        <Typography variant="body1" color="text.secondary">
          Task Queued: {userInterfaceState.meshyQueueItems} tasks ahead.
        </Typography>
      )}
      {(isLoading && !isPending) && (
        <Typography variant="h5" color="primary.main" fontWeight={600}>
          {userInterfaceState.meshyLoadedPercentage}%
        </Typography>
      )}
    </Box>
  )
}

export default MeshyLoading
