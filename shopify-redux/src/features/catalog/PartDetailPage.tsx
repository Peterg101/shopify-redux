import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Chip,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import DownloadIcon from "@mui/icons-material/Download";
import { useGetPartDetailQuery } from "../../services/catalogApi";
import { OrderFromPartDialog } from "./OrderFromPartDialog";

export const PartDetailPage = () => {
  const { partId } = useParams<{ partId: string }>();
  const navigate = useNavigate();
  const [orderOpen, setOrderOpen] = useState(false);

  const { data: part, isLoading, error } = useGetPartDetailQuery(partId!, {
    skip: !partId,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !part) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography color="error">Part not found</Typography>
        <Button onClick={() => navigate("/catalog")} sx={{ mt: 1 }}>
          Back to Catalog
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <IconButton onClick={() => navigate("/catalog")} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={600} sx={{ flexGrow: 1 }}>
          {part.name}
        </Typography>
        <Button
          variant="contained"
          startIcon={<ShoppingCartIcon />}
          onClick={() => setOrderOpen(true)}
          size="small"
        >
          Order This Part
        </Button>
      </Box>

      {/* Preview area */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <Box
          sx={{
            height: 300,
            bgcolor: "action.hover",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="h3" color="text.disabled">
            3D Preview
          </Typography>
        </Box>
      </Card>

      {/* Details */}
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {/* Left: Metadata */}
        <Box sx={{ flex: 1, minWidth: 250 }}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              {part.description && (
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {part.description}
                </Typography>
              )}

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 2 }}>
                <Chip label={part.file_type.toUpperCase()} size="small" color="primary" />
                {part.category && <Chip label={part.category} size="small" variant="outlined" />}
                {part.recommended_process && (
                  <Chip label={part.recommended_process} size="small" variant="outlined" />
                )}
                {part.recommended_material && (
                  <Chip label={part.recommended_material} size="small" variant="outlined" />
                )}
              </Box>

              {part.tags && part.tags.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 2 }}>
                  {part.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" color="default" />
                  ))}
                </Box>
              )}

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
                <DownloadIcon sx={{ fontSize: 16 }} />
                <Typography variant="body2">{part.download_count} orders</Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Right: Geometry */}
        {(part.bounding_box_x || part.volume_cm3) && (
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                  Geometry
                </Typography>
                {part.bounding_box_x && (
                  <Typography variant="body2">
                    Bounding Box: {part.bounding_box_x} x {part.bounding_box_y} x{" "}
                    {part.bounding_box_z} mm
                  </Typography>
                )}
                {part.volume_cm3 && (
                  <Typography variant="body2">
                    Volume: {part.volume_cm3} cm³
                  </Typography>
                )}
                {part.surface_area_cm2 && (
                  <Typography variant="body2">
                    Surface Area: {part.surface_area_cm2} cm²
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        )}
      </Box>

      {/* Order Dialog */}
      <OrderFromPartDialog
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        part={part}
      />
    </Box>
  );
};
