import { useState } from 'react';
import * as THREE from "three";
import Table from '@mui/material/Table';
import Box from '@mui/material/Box';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import Grid from '@mui/material/Grid';
import MuiInput from '@mui/material/Input';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { setMultiplierValue } from '../../services/dataSlice';

const SizingOptions = () => {
  const dispatch = useDispatch();
  const dataState = useSelector((state: RootState) => state.dataState);

  const handleChange = (event: Event, newValue: number | number[]) => {
    if (typeof newValue === 'number') {
      dispatch(setMultiplierValue({ multiplierValue: newValue }));
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = Number(event.target.value);
    if (inputValue >= dataState.minScale && inputValue <= dataState.maxScale) {
      dispatch(setMultiplierValue({ multiplierValue: inputValue }));
    }
  };

  const handleBlur = () => {
    if (dataState.multiplierValue > dataState.maxScale) {
      dispatch(setMultiplierValue({ multiplierValue: dataState.maxScale }));
    }
    if (dataState.multiplierValue < dataState.minScale) {
      dispatch(setMultiplierValue({ multiplierValue: dataState.minScale }));
    }
  };

  const marks = [
    { value: dataState.minScale, label: String(dataState.minScale) },
    { value: 1 },
    { value: dataState.maxScale, label: String(dataState.maxScale) },
  ];

  return (
    <Stack direction="row" spacing={4} alignItems="center" sx={{ width: '100%' }}>
      <TableContainer 
        component={Paper} 
        sx={{
          width: 300,
          height: 150,
          overflow: 'hidden',
          maxWidth: 'none',
          maxHeight: 'none',
          flexShrink: 0
        }}
      >
        <Table 
          sx={{
            width: 300,
            height: '100%',
            tableLayout: 'fixed'
          }} 
          aria-label="simple table"
        >
          <TableHead>
            <TableRow>
              <TableCell>Volume (cm<sup>3</sup>)</TableCell>
              <TableCell align="right">X (cm)</TableCell>
              <TableCell align="right">Y (cm)</TableCell>
              <TableCell align="right">Z (cm)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
              <TableCell component="th" scope="row">
                {(dataState.modelVolume * 0.01).toFixed(1)}
              </TableCell>
              <TableCell align="right">
                {dataState.modelDimensions ? (dataState.modelDimensions.position.x / 10).toFixed(2) : "N/A"}
              </TableCell>
              <TableCell align="right">
                {dataState.modelDimensions ? (dataState.modelDimensions.position.y / 10).toFixed(2) : "N/A"}
              </TableCell>
              <TableCell align="right">
                {dataState.modelDimensions ? (dataState.modelDimensions.position.z / 10).toFixed(2) : "N/A"}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ width: 800, minWidth: 100 }}>
        <Stack spacing={2} direction="row" sx={{ mb: 1 }} alignItems="center">
          <Slider 
            aria-label="Volume" 
            value={dataState.multiplierValue}
            onChange={handleChange}
            marks={marks} 
            min={dataState.minScale} 
            step={0.01} 
            max={dataState.maxScale}  
          />
        </Stack>
        <Box sx={{ marginTop: 5 }}>
          <MuiInput
            value={dataState.multiplierValue}
            size="small"
            onChange={handleInputChange}
            onBlur={handleBlur}
            inputProps={{
              step: 0.01,
              min: dataState.minScale,
              max: dataState.maxScale,
              type: 'number',
              'aria-labelledby': 'input-slider',
            }}
          />
        </Box>
      </Box>
    </Stack>
  );
};

export default SizingOptions;
