import * as React from 'react';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { setModelColour } from '../../services/dataSlice';

export const ColourSelectDropdown = () => {
  const dispatch = useDispatch()
  const dataState = useSelector((state: RootState) => state.dataState)

  const colours = [
    'red', 'blue', 'green', 'orange', 'purple', 'black', 'white', 'grey'
  ];

  const handleChange = (event: SelectChangeEvent) => {
    dispatch(setModelColour({ modelColour: event.target.value }))
  };

  return (
    <Box sx={{ minWidth: 120 }}>
      <FormControl fullWidth>
        <InputLabel id="colour-select-label">Colour</InputLabel>
        <Select
          labelId="colour-select-label"
          id="colour-select"
          value={dataState.modelColour}
          label="Colour"
          onChange={handleChange}
        >
          {colours.map((colour) => (
            <MenuItem key={colour} value={colour}>
              {colour}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
