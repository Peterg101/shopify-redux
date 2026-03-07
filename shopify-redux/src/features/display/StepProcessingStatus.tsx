import { Box, Typography, LinearProgress } from "@mui/material";

interface Props {
  progress: number;
  status: string;
  filename: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Queued...",
  processing: "Processing STEP file...",
  complete: "Processing complete",
  failed: "Processing failed",
};

export const StepProcessingStatus = ({ progress, status, filename }: Props) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        py: 4,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {filename}
      </Typography>
      <Typography variant="h6" color="primary">
        {STATUS_LABELS[status] ?? status}
      </Typography>
      <Box sx={{ width: "80%", maxWidth: 400 }}>
        <LinearProgress
          variant={status === "processing" ? "determinate" : "indeterminate"}
          value={progress}
          sx={{
            height: 8,
            borderRadius: 4,
            "& .MuiLinearProgress-bar": {
              borderRadius: 4,
            },
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary">
        {progress}%
      </Typography>
    </Box>
  );
};
