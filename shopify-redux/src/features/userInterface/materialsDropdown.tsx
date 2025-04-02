import * as React from 'react';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { Grid } from '@mui/material';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { setPrintMaterial, setPrintTechnique } from '../../services/dataSlice';
import { PricingConfig } from '../../app/utility/interfaces';
import pricingConfig from "./../../config/pricingConfig.json"
import { getPrice } from '../../app/utility/utils';
export const MaterialSelectDropdown = ()=> {

const dispatch = useDispatch()
const dataState = useSelector(
    (state: RootState) => state.dataState
)

const config: PricingConfig = pricingConfig;
  const { techniques, materials } = config;

  const handlePrintTechniqueChange = (event: SelectChangeEvent) => {
    dispatch(setPrintTechnique({printTechnique: event.target.value}))
  };

  const handlePrintMaterialChange = (event: SelectChangeEvent)=>{
    const printMaterial = event.target.value
    const materialCost = getPrice(printMaterial, config)
    dispatch(setPrintMaterial({printMaterial: printMaterial, materialCost: materialCost}))
  }

  return (
    <Box sx={{ minWidth: 120 }}>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <FormControl fullWidth>
            <InputLabel id="print-technique-label">Print Technique</InputLabel>
            <Select
              labelId="print-technique-label"
              id="print-technique-select"
              value={dataState.printTechnique}
              label="Print Technique"
              onChange={handlePrintTechniqueChange}
            >
              {techniques.map((technique) => (
                <MenuItem key={technique} value={technique}>
                  {technique}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <FormControl fullWidth>
            <InputLabel id="print-material-label">Print Material</InputLabel>
            <Select
              labelId="print-material-label"
              id="print-material-select"
              value={dataState.printMaterial}
              label="Print Material"
              onChange={handlePrintMaterialChange}
            >
              {materials[dataState.printTechnique]?.map((material) => (
                <MenuItem key={material.name} value={material.name}>
                  {material.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
};

