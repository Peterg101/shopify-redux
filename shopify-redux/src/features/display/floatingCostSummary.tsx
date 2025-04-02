import React, { useEffect, useMemo } from "react";
import { Box, Typography, Divider } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { recalculateTotalCost } from "../../app/utility/utils";
import { setTotalCost } from "../../services/dataSlice";

export const FloatingCostSummary = () => {
  const dispatch = useDispatch();
  const { displayObjectConfig, selectedFile, printMaterial, materialCost, multiplierValue, modelVolume, totalCost } = 
    useSelector((state: RootState) => state.dataState);

  // Use useMemo to avoid unnecessary recalculations
  const computedTotalCost = useMemo(() => recalculateTotalCost({ modelVolume, materialCost, multiplierValue }), [
    modelVolume,
    materialCost,
    multiplierValue,
  ]);

  // Only dispatch if the computed value has changed
  useEffect(() => {
    if (computedTotalCost !== totalCost) {
      dispatch(setTotalCost({ totalCost: computedTotalCost }));
    }
  }, [computedTotalCost, totalCost, dispatch]);

  if (!displayObjectConfig || !selectedFile) return null; // Only show when active

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

      {/* Total Cost Highlighted */}
      <Box sx={{ textAlign: "center", mt: "auto" }}>
        <Typography variant="h6" sx={{ fontWeight: "bold", color: "primary.main" }}>
          Total: £{totalCost.toFixed(2)}
        </Typography>
      </Box>
    </Box>
  );
};