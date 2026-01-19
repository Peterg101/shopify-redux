import {
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  Paper,
  Divider,
  Grid,
  Dialog,
  DialogActions,
  DialogTitle,
} from "@mui/material";
import { Add, Remove, OpenInFull } from "@mui/icons-material";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import OBJSTLViewer from "../display/objStlViewer";
import { setClaimedOrder } from "../../services/userInterfaceSlice";
import { resetDataState, setFulfillMode } from "../../services/dataSlice";
import { ClaimOrder } from "../../app/utility/interfaces";
import { postClaimOrder } from "../../services/fetchFileUtils";
import { generateUuid } from "../../app/utility/utils";
import { authApi } from "../../services/authApi";

export const ClaimMenu: React.FC = () => {
  const { claimedOrder } = useSelector(
    (state: RootState) => state.userInterfaceState
  );

  const [quantity, setQuantity] = useState(claimedOrder.quantity);
  const [viewerOpen, setViewerOpen] = useState(false);
  const dispatch = useDispatch();

  const increment = () =>
    setQuantity((q) => (q < claimedOrder.quantity ? q + 1 : q));
  const decrement = () => setQuantity((q) => (q > 1 ? q - 1 : q));

  const confirmClaim = async () => {
    console.log(`✅ Confirmed claim of ${quantity} item(s)`);
    const claimOrder: ClaimOrder = {
      id: generateUuid(),
      order_id: claimedOrder.order_id,
      quantity: quantity,
      status: "in_progress"

    }
    await postClaimOrder(claimOrder)
    dispatch(authApi.util.invalidateTags(['sessionData']));
    dispatch(setClaimedOrder({ claimedOrder: null }));
  };

  const handleCancel = () => {
    dispatch(setClaimedOrder({ claimedOrder: null }));
    dispatch(resetDataState());
    dispatch(setFulfillMode({ fulfillMode: false }));
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "#f8f9fa",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        py: 10,
        px: 3,
      }}
    >
      <Grid
        container
        spacing={4}
        sx={{
          maxWidth: 1200,
          width: "100%",
          alignItems: "stretch", // Ensures equal column height
        }}
      >
        {/* LEFT COLUMN — 3D VIEWER */}
        <Grid item xs={12} md={7}>
          <Paper
            elevation={4}
            sx={{
              borderRadius: 3,
              overflow: "hidden",
              height: "100%",
              minHeight: 600,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <OBJSTLViewer />
            <IconButton
              onClick={() => setViewerOpen(true)}
              aria-label="Expand 3D viewer"
              sx={{
                position: "absolute",
                top: 12,
                right: 12,
                backgroundColor: "rgba(255, 255, 255, 0.85)",
                "&:hover": { backgroundColor: "white" },
                boxShadow: 2,
              }}
            >
              <OpenInFull />
            </IconButton>
          </Paper>
        </Grid>

        {/* RIGHT COLUMN — ORDER DETAILS + CLAIM PANEL */}
      <Grid
        item
        xs={12}
        md={5}
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "stretch",
          alignItems: "stretch",
          gap: 3, // consistent spacing between panels
        }}
      >
        {/* ORDER DETAILS PANEL */}
        <Paper
          elevation={2}
          sx={{
            flex: 1,
            p: 3,
            borderRadius: 3,
            display: "flex",
            flexDirection: "column",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Order Information
          </Typography>

          <Divider sx={{ mb: 2 }} />

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography variant="body1">
              <strong>Name:</strong> {claimedOrder.name}
            </Typography>
            <Typography variant="body1">
              <strong>Material:</strong> {claimedOrder.material}
            </Typography>
            <Typography variant="body1">
              <strong>Technique:</strong> {claimedOrder.technique}
            </Typography>
            <Typography variant="body1">
              <strong>Colour:</strong> {claimedOrder.colour}
            </Typography>
            <Typography variant="body1">
              <strong>Size:</strong> {claimedOrder.sizing}
            </Typography>
            <Typography variant="body1">
              <strong>Quantity:</strong> {claimedOrder.quantity}
            </Typography>
            {/* <Typography variant="body1">
              <strong>Price (per unit):</strong> ${claimedOrder.price.toFixed(2)}
            </Typography> */}
            <Typography variant="body1">
              <strong>Status:</strong> {claimedOrder.status}{" "}
              {claimedOrder.is_collaborative && "(Collaborative)"}
            </Typography>
          </Box>
        </Paper>

        {/* CLAIM ITEMS PANEL */}
        <Paper
          elevation={3}
          sx={{
            flex: 1,
            p: 4,
            borderRadius: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <Typography variant="h4" fontWeight={600} gutterBottom>
            Claim Items
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            textAlign="center"
            mb={3}
          >
            You can claim up to <strong>{claimedOrder.quantity}</strong> items from
            this order.
          </Typography>

          <Divider sx={{ width: "100%", mb: 3 }} />

          {/* Quantity Controls */}
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap={2}
            mb={3}
          >
            <IconButton
              onClick={decrement}
              color="primary"
              disabled={quantity <= 1}
              sx={{
                bgcolor: "#f1f3f5",
                "&:hover": { bgcolor: "#e9ecef" },
              }}
            >
              <Remove />
            </IconButton>

            <TextField
              type="number"
              size="small"
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= claimedOrder.quantity) {
                  setQuantity(val);
                }
              }}
              inputProps={{
                min: 1,
                max: claimedOrder.quantity,
                style: { textAlign: "center", width: "70px" },
              }}
            />

            <IconButton
              onClick={increment}
              color="primary"
              disabled={quantity >= claimedOrder.quantity}
              sx={{
                bgcolor: "#f1f3f5",
                "&:hover": { bgcolor: "#e9ecef" },
              }}
            >
              <Add />
            </IconButton>
          </Box>

          {/* Confirm + Cancel Buttons */}
          <Box display="flex" gap={2} width="100%" mt="auto">
            <Button
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              sx={{
                py: 1.4,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
              }}
              onClick={confirmClaim}
            >
              Confirm Claim
            </Button>

            <Button
              variant="outlined"
              color="secondary"
              size="large"
              fullWidth
              sx={{
                py: 1.4,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
              }}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </Box>
        </Paper>
      </Grid>

      </Grid>

      {/* Expanded Viewer Dialog */}
      <Dialog open={viewerOpen} onClose={() => setViewerOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{claimedOrder.name}</DialogTitle>
        <Box>
          <OBJSTLViewer />
        </Box>
        <DialogActions>
          <Button onClick={() => setViewerOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
