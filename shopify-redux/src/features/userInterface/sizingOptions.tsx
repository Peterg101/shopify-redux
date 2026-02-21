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
import MuiInput from '@mui/material/Input';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { setMultiplierValue } from '../../services/dataSlice';
import { monoFontFamily } from '../../theme';

const SizingOptions = () => {
  const dispatch = useDispatch();
  const dataState = useSelector((state: RootState) => state.dataState);

  const handleChange = (_event: Event, newValue: number | number[]) => {
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
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} alignItems="center" sx={{ width: '100%' }}>
      <TableContainer
        component={Paper}
        sx={{ width: { xs: '100%', md: 300 }, flexShrink: 0 }}
      >
        <Table sx={{ tableLayout: 'fixed' }} aria-label="Model dimensions">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontFamily: monoFontFamily }}>Vol (cm³)</TableCell>
              <TableCell align="right" sx={{ fontFamily: monoFontFamily }}>X (cm)</TableCell>
              <TableCell align="right" sx={{ fontFamily: monoFontFamily }}>Y (cm)</TableCell>
              <TableCell align="right" sx={{ fontFamily: monoFontFamily }}>Z (cm)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
              <TableCell component="th" scope="row" sx={{ fontFamily: monoFontFamily }}>
                {(dataState.modelVolume * 0.01).toFixed(1)}
              </TableCell>
              <TableCell align="right" sx={{ fontFamily: monoFontFamily }}>
                {dataState.modelDimensions ? (dataState.modelDimensions.position.x / 10).toFixed(2) : "N/A"}
              </TableCell>
              <TableCell align="right" sx={{ fontFamily: monoFontFamily }}>
                {dataState.modelDimensions ? (dataState.modelDimensions.position.y / 10).toFixed(2) : "N/A"}
              </TableCell>
              <TableCell align="right" sx={{ fontFamily: monoFontFamily }}>
                {dataState.modelDimensions ? (dataState.modelDimensions.position.z / 10).toFixed(2) : "N/A"}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ width: { xs: '100%', md: 800 }, minWidth: 100 }}>
        <Stack spacing={2} direction="row" sx={{ mb: 1 }} alignItems="center">
          <Slider
            aria-label="Model scale"
            value={dataState.multiplierValue}
            onChange={handleChange}
            marks={marks}
            min={dataState.minScale}
            step={0.01}
            max={dataState.maxScale}
          />
        </Stack>
        <Box sx={{ mt: 2 }}>
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
              'aria-label': 'Model scale value',
            }}
          />
        </Box>
      </Box>
    </Stack>
  );
};

export default SizingOptions;
