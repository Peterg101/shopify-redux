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

export const MaterialSelectDropdown = ()=> {

const dispatch = useDispatch()
const dataState = useSelector(
    (state: RootState) => state.dataState
)
  const Techniques = [
    'Resin',
    'FDM',
    ];

  const FDMMaterials = [
    'PLA Basic',
    'PLA Matte',
    'PLA Silk',
    'PLA CF',
    'PETG',
    'PETG+',
    'PETG CF'
  ]

  const ResinMaterials = [
    'Resinny Resin', 
    'Even Ressinier Resin'
  ]

  const handlePrintTechniqueChange = (event: SelectChangeEvent) => {
    dispatch(setPrintTechnique({printTechnique: event.target.value}))
  };

  const handlePrintMaterialChange = (event: SelectChangeEvent)=>{
    dispatch(setPrintMaterial({printMaterial: event.target.value}))
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
            //   disabled={!hasStatePopulationErrors}
            >
              {Techniques.map((technique) => (
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
            {dataState.printTechnique === 'FDM' ? <Select
              labelId="print-material-label"
              id="print-material-select"
              value={dataState.printMaterial}
              label="Print Material"
              onChange={handlePrintMaterialChange}
            //   disabled={!hasStatePopulationErrors}
            >
              {FDMMaterials.map((material) => (
                <MenuItem key={material} value={material}>
                  {material}
                </MenuItem>
              ))}
            </Select> : <Select
              labelId="print-material-label"
              id="print-material-select"
              value={dataState.printMaterial}
              label="Print Material"
              onChange={handlePrintMaterialChange}
            //   disabled={!hasStatePopulationErrors}
            >
              {ResinMaterials.map((material) => (
                <MenuItem key={material} value={material}>
                  {material}
                </MenuItem>
              ))}
            </Select>}
            
            
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
}

