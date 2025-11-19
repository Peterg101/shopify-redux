import { Box, TextField, Paper, Typography } from "@mui/material"
import { ClearFile } from "../userInterface/clearFile";
import { AddToBasket } from "../userInterface/addToBasket";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { ChangeEvent } from "react";
import { setFileNameBoxValue } from "../../services/dataSlice";

export const ToolBar = () => {
  const dispatch = useDispatch();
  const dataState = useSelector((state: RootState) => state.dataState);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch(setFileNameBoxValue({ fileNameBoxValue: event.target.value }));
  };

  return (
    <Paper
      
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 2,
        gap: 2,
        mb: 4,
      }}
    >
      {/* Clear button */}
      <Box>
        <ClearFile />
      </Box>

      {/* Current Price */}
      <Typography
  variant="h6"
  sx={{
    fontWeight: 600,
    fontSize: '1.25rem',
    minWidth: 150,
    textAlign: 'center',
    backgroundColor: '#1976d2', // nice blue accent
    color: '#fff',
    borderRadius: 2,
    px: 2,
    py: 1,
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  }}
>
  £
  <Box
    component="span"
    sx={{ fontWeight: 'bold', fontSize: '1.5rem', ml: 0.5 }}
  >
    {dataState.totalCost.toFixed(2)}
  </Box>
</Typography>

      {/* File Name Input */}
      <TextField
        label="File Name"
        variant="outlined"
        size="small"
        value={dataState.fileNameBoxValue}
        onChange={handleChange}
        sx={{ flexGrow: 1, minWidth: 200 }}
      />

      {/* Add to Basket */}
      <Box>
        <AddToBasket />
      </Box>
    </Paper>
  );
};