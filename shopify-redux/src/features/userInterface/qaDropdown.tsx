import * as React from 'react';
import {
  Box, Grid, TextField, MenuItem,
  FormControl, InputLabel, Select, SelectChangeEvent
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../app/store';
// import { setQALevel, setCustomQAField } from '../../services/dataSlice';

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
  // const { qaLevel, customQA } = useSelector((state: RootState) => state.dataState);

  // const isEditable = qaLevel === 'custom';
  const isEditable = "custom"
  // const currentProfile = isEditable ? customQA : defaultQAProfiles[qaLevel];
  const currentProfile = defaultQAProfiles.standard
  const handleQALevelChange = (event: SelectChangeEvent) => {
    // dispatch(setQALevel({ qaLevel: event.target.value }));
  };

  const handleFieldChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    // dispatch(setCustomQAField({ field, value: event.target.value }));
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
              value={"custom"}
              label="QA Level"
              onChange={handleQALevelChange}
            >
              <MenuItem value="standard">Standard</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Dimensional Tolerance"
            value={currentProfile.dimensionalTolerance}
            InputProps={{ readOnly: !isEditable }}
            onChange={handleFieldChange('dimensionalTolerance')}
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Photo Evidence Required"
            value={currentProfile.photoEvidence}
            InputProps={{ readOnly: !isEditable }}
            onChange={handleFieldChange('photoEvidence')}
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Surface Finish"
            value={currentProfile.surfaceFinish}
            InputProps={{ readOnly: !isEditable }}
            onChange={handleFieldChange('surfaceFinish')}
          />
        </Grid>
      </Grid>
    </Box>
  );
};