import { Box, Chip, Typography } from "@mui/material";
import { FulfillerProfile } from "../../app/utility/interfaces";

const PROCESS_FAMILY_LABELS: Record<string, string> = {
  "3d_printing": "3D Printing",
  cnc: "CNC Machining",
  sheet_metal: "Sheet Metal",
  casting: "Casting",
  injection_molding: "Injection Molding",
};

interface Props {
  profile: FulfillerProfile;
}

export const FulfillerCapabilityDisplay = ({ profile }: Props) => {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="subtitle1" fontWeight={600}>
        {profile.business_name}
      </Typography>

      {profile.description && (
        <Typography variant="body2" color="text.secondary">
          {profile.description}
        </Typography>
      )}

      {/* Processes */}
      {profile.capabilities.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Processes
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
            {profile.capabilities.map((cap) => (
              <Chip
                key={cap.id}
                label={cap.process.display_name}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Build Volume */}
      {profile.max_build_volume_x && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Max Build Volume
          </Typography>
          <Typography variant="body2">
            {profile.max_build_volume_x} x {profile.max_build_volume_y} x{" "}
            {profile.max_build_volume_z} mm
          </Typography>
        </Box>
      )}

      {/* Tolerance */}
      {profile.min_tolerance_mm && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Min Tolerance
          </Typography>
          <Typography variant="body2">
            {profile.min_tolerance_mm} mm
          </Typography>
        </Box>
      )}

      {/* Lead Time */}
      {profile.lead_time_days_min && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Lead Time
          </Typography>
          <Typography variant="body2">
            {profile.lead_time_days_min}–{profile.lead_time_days_max} business
            days
          </Typography>
        </Box>
      )}

      {/* Certifications */}
      {profile.certifications && profile.certifications.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Certifications
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
            {profile.certifications.map((cert) => (
              <Chip
                key={cert}
                label={cert}
                size="small"
                color="success"
                variant="outlined"
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Post-Processing */}
      {profile.post_processing && profile.post_processing.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Post-Processing
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
            {profile.post_processing.map((pp) => (
              <Chip key={pp} label={pp} size="small" variant="outlined" />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};
