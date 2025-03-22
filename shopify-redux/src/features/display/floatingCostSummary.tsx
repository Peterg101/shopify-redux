import React, { useState } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";

export const FloatingCostSummary = () => {
  const { displayObjectConfig, selectedFile} = useSelector(
    (state: RootState) => state.dataState
  );

  const [expanded, setExpanded] = useState(true);

  if (!displayObjectConfig || !selectedFile) return null; // Only show when active

  return (
    <Box
      sx={{
        position: "fixed",
        top: 170,
        right: 30,
        backgroundColor: "white",
        borderRadius: 2,
        boxShadow: 3,
        p: 2,
        width: expanded ? 300 : 300,
        transition: "width 0.3s ease-in-out",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="h6">Cost Summary</Typography>
        <IconButton onClick={() => setExpanded(!expanded)} size="small">
          {expanded ? <CloseIcon /> : "💰"}
        </IconButton>
      </Box>

      {expanded && (
        <Box>
          <Typography variant="body2">Material: 100 </Typography>
          <Typography variant="body2">Sizing: 100</Typography>
          <Typography variant="body2">Total Cost: </Typography>
        </Box>
      )}
    </Box>
  );
};