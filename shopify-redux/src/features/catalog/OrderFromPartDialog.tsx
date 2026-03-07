import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
  CircularProgress,
  Typography,
} from "@mui/material";
import { useOrderFromPartMutation } from "../../services/catalogApi";
import { Part } from "../../app/utility/interfaces";

interface Props {
  open: boolean;
  onClose: () => void;
  part: Part;
}

export const OrderFromPartDialog = ({ open, onClose, part }: Props) => {
  const [material, setMaterial] = useState(part.recommended_material ?? "PLA Basic");
  const [technique, setTechnique] = useState(part.recommended_process ?? "FDM");
  const [quantity, setQuantity] = useState(1);
  const [colour, setColour] = useState("white");
  const [error, setError] = useState<string | null>(null);

  const [orderFromPart, { isLoading }] = useOrderFromPartMutation();

  const handleSubmit = async () => {
    if (quantity < 1) {
      setError("Quantity must be at least 1");
      return;
    }
    setError(null);

    try {
      await orderFromPart({
        partId: part.id,
        config: {
          material,
          technique,
          quantity,
          colour,
        },
      }).unwrap();
      onClose();
    } catch (err: any) {
      setError(err?.data?.detail ?? "Failed to add to basket");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Order: {part.name}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {part.bounding_box_x && (
            <Typography variant="body2" color="text.secondary">
              Size: {part.bounding_box_x} x {part.bounding_box_y} x{" "}
              {part.bounding_box_z} mm
            </Typography>
          )}

          <TextField
            label="Material"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            size="small"
            fullWidth
          />

          <TextField
            label="Technique"
            value={technique}
            onChange={(e) => setTechnique(e.target.value)}
            size="small"
            fullWidth
          />

          <TextField
            label="Quantity"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            type="number"
            size="small"
            inputProps={{ min: 1 }}
          />

          <TextField
            label="Colour"
            value={colour}
            onChange={(e) => setColour(e.target.value)}
            size="small"
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          size="small"
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={18} /> : "Add to Basket"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
