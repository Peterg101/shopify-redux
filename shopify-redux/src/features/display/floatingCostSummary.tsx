import React from "react";
import { Box, Typography, Divider } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { selectTotalCost } from "../../services/selectors";
import { monoFontFamily } from "../../theme";

export const FloatingCostSummary = () => {
  const {
    displayObjectConfig,
    selectedFile,
    printMaterial,
    materialCost,
    multiplierValue,
    modelVolume,
  } = useSelector((state: RootState) => state.dataState);

  const totalCost = useSelector(selectTotalCost);

  if (!displayObjectConfig || !selectedFile) return null;

  return (
    <Box
      sx={{
        backgroundColor: "background.paper",
        p: 2,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Divider />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="body2">
          <strong>Material:</strong> {printMaterial}
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: monoFontFamily }}>
          <strong>Cost per cm³:</strong> £{materialCost}
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: monoFontFamily }}>
          <strong>Sizing:</strong> {multiplierValue}x
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: monoFontFamily }}>
          <strong>Volume:</strong> {(modelVolume / 100).toFixed(1)} cm³
        </Typography>
      </Box>

      <Divider />

      <Box sx={{ textAlign: "center", mt: "auto" }}>
        <Typography variant="h6" sx={{ fontWeight: "bold", color: "primary.main", fontFamily: monoFontFamily }}>
          Total: £{totalCost.toFixed(2)}
        </Typography>
      </Box>
    </Box>
  );
};
