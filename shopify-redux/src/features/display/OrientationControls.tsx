import React, { useState } from 'react';
import { Box, Typography, Slider } from '@mui/material';
import { ThreeDRotation } from '@mui/icons-material';
import { useDispatch } from 'react-redux';
import { setXFLip, setYFLip, setZFLip } from '../../services/dataSlice';
import { degreesToRadians } from '../../app/utility/utils';

export const OrientationControls = () => {
  const dispatch = useDispatch();
  const [xValue, setXValue] = useState(0);
  const [yValue, setYValue] = useState(0);
  const [zValue, setZValue] = useState(0);

  const handleX = (_e: Event, v: number | number[]) => {
    if (typeof v === 'number') {
      dispatch(setXFLip({ xFlip: degreesToRadians(v) }));
      setXValue(v);
    }
  };
  const handleY = (_e: Event, v: number | number[]) => {
    if (typeof v === 'number') {
      dispatch(setYFLip({ yFlip: degreesToRadians(v) }));
      setYValue(v);
    }
  };
  const handleZ = (_e: Event, v: number | number[]) => {
    if (typeof v === 'number') {
      dispatch(setZFLip({ zFlip: degreesToRadians(v) }));
      setZValue(v);
    }
  };

  const sliderSx = { flex: 1, mx: 1 };
  const labelSx = { fontFamily: 'monospace', fontSize: '0.75rem', minWidth: 42, textAlign: 'right' as const };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        borderTop: '1px solid rgba(0, 229, 255, 0.12)',
        backgroundColor: 'rgba(0, 229, 255, 0.04)',
      }}
    >
      <ThreeDRotation sx={{ color: 'primary.main', fontSize: 18 }} />
      <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
        Orientation
      </Typography>

      <Typography variant="caption" sx={labelSx}>X: {xValue}°</Typography>
      <Slider aria-label="X axis rotation" value={xValue} onChange={handleX} min={-180} max={180} step={1} size="small" sx={sliderSx} />

      <Typography variant="caption" sx={labelSx}>Y: {yValue}°</Typography>
      <Slider aria-label="Y axis rotation" value={yValue} onChange={handleY} min={-180} max={180} step={1} size="small" sx={sliderSx} />

      <Typography variant="caption" sx={labelSx}>Z: {zValue}°</Typography>
      <Slider aria-label="Z axis rotation" value={zValue} onChange={handleZ} min={-180} max={180} step={1} size="small" sx={sliderSx} />
    </Box>
  );
};
