import React, { useEffect } from "react";
import { Box, Typography, Divider } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { recalculateTotalCost } from "../../app/utility/utils";
import { setTotalCost } from "../../services/dataSlice";

export const FloatingCostSummary = () => {
  const dispatch = useDispatch();

  const {
    displayObjectConfig,
    selectedFile,
    printMaterial,
    materialCost,
    multiplierValue,
    modelVolume,
    totalCost,
  } = useSelector((state: RootState) => state.dataState);

  if (!displayObjectConfig || !selectedFile) return null;

  return (
    <Box
      sx={{
        backgroundColor: "white",
        p: 2,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Divider />

      {/* Cost Breakdown */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="body2">
          <strong>Material:</strong> {printMaterial}
        </Typography>
        <Typography variant="body2">
          <strong>Cost per cm³:</strong> £{materialCost}
        </Typography>
        <Typography variant="body2">
          <strong>Sizing:</strong> {multiplierValue}x
        </Typography>
        <Typography variant="body2">
          <strong>Volume:</strong> {(modelVolume / 100).toFixed(1)} cm³
        </Typography>
      </Box>

      <Divider />

      {/* Total Cost */}
      <Box sx={{ textAlign: "center", mt: "auto" }}>
        <Typography variant="h6" sx={{ fontWeight: "bold", color: "primary.main" }}>
          Total: £{totalCost.toFixed(2)}
        </Typography>
      </Box>
    </Box>
  );
};
