import React from "react";
import { Box, Typography, Divider } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";

export const FloatingCostSummary = () => {
  const dataState = useSelector((state: RootState) => state.dataState);

  if (!dataState.displayObjectConfig || !dataState.selectedFile) return null; // Only show when active

  return (
    <Box
      sx={{
        backgroundColor: "white",
        p: 2,
        width: "100%", // Full width of the sidebar
        height: "100%", // Full height to occupy the entire sidebar
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {/* Title */}


      <Divider />

      {/* Cost Breakdown */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="body2">
          <strong>Material:</strong> {dataState.printMaterial}
        </Typography>
        <Typography variant="body2">
          <strong>Cost per cm³:</strong> £{dataState.materialCost}
        </Typography>
        <Typography variant="body2">
          <strong>Sizing:</strong> {dataState.multiplierValue}x
        </Typography>
        <Typography variant="body2">
          <strong>Volume:</strong> {(dataState.modelVolume / 100).toFixed(1)} cm³
        </Typography>
      </Box>

      <Divider />

      {/* Total Cost Highlighted */}
      <Box sx={{ textAlign: "center", mt: "auto" }}>
        <Typography variant="h6" sx={{ fontWeight: "bold", color: "primary.main" }}>
          Total: £{dataState.totalCost}
        </Typography>
      </Box>
    </Box>
  );
};