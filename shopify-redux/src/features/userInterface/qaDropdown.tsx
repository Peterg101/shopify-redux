import * as React from 'react';
import {
  Box, Grid, TextField, MenuItem,
  FormControl, InputLabel, Select, SelectChangeEvent
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { setQALevel } from '../../services/dataSlice';

const defaultQAProfiles = {
  standard: {
    dimensionalTolerance: '±0.5mm',
    photoEvidence: 'No',
    surfaceFinish: 'Standard',
  },
  high: {
    dimensionalTolerance: '±0.2mm',
    photoEvidence: 'Yes',
    surfaceFinish: 'Smooth',
  },
};

export const QADropdown = () => {
  const dispatch = useDispatch();
  const { qaLevel } = useSelector((state: RootState) => state.dataState);

  const currentProfile = defaultQAProfiles[qaLevel];

  const handleQALevelChange = (event: SelectChangeEvent) => {
    const value = event.target.value as "standard" | "high";
    dispatch(setQALevel({ qaLevel: value }));
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel id="qa-level-label">QA Level</InputLabel>
            <Select
              labelId="qa-level-label"
              id="qa-level-select"
              value={qaLevel}
              label="QA Level"
              onChange={handleQALevelChange}
            >
              <MenuItem value="standard">Standard</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Dimensional Tolerance"
            value={currentProfile.dimensionalTolerance}
            InputProps={{ readOnly: true }}
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Photo Evidence Required"
            value={currentProfile.photoEvidence}
            InputProps={{ readOnly: true }}
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Surface Finish"
            value={currentProfile.surfaceFinish}
            InputProps={{ readOnly: true }}
          />
        </Grid>
      </Grid>
    </Box>
  );
};
