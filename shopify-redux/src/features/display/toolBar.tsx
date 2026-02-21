import { Box, TextField, Paper, Typography } from "@mui/material"
import { ClearFile } from "../userInterface/clearFile";
import { AddToBasket } from "../userInterface/addToBasket";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { ChangeEvent } from "react";
import { setFileNameBoxValue } from "../../services/dataSlice";
import { selectTotalCost } from "../../services/selectors";
import { monoFontFamily } from "../../theme";

export const ToolBar = () => {
  const dispatch = useDispatch();
  const dataState = useSelector((state: RootState) => state.dataState);
  const totalCost = useSelector(selectTotalCost);

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
      <Box>
        <ClearFile />
      </Box>

      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          fontSize: '1.25rem',
          minWidth: 150,
          textAlign: 'center',
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
          borderRadius: 2,
          px: 2,
          py: 1,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          fontFamily: monoFontFamily,
        }}
      >
        £
        <Box
          component="span"
          sx={{ fontWeight: 'bold', fontSize: '1.5rem', ml: 0.5 }}
        >
          {totalCost.toFixed(2)}
        </Box>
      </Typography>

      <TextField
        label="File Name"
        variant="outlined"
        size="small"
        value={dataState.fileNameBoxValue}
        onChange={handleChange}
        sx={{ flexGrow: 1, minWidth: 200 }}
      />

      <Box>
        <AddToBasket />
      </Box>
    </Paper>
  );
};
