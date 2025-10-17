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
    DialogContent,
    DialogTitle,
    DialogActions,
  } from "@mui/material";
  import { Add, Remove, OpenInFull } from "@mui/icons-material";

  import { useEffect, useState } from "react";
  import { useDispatch, useSelector } from "react-redux";
  import { RootState } from "../../app/store";
  import OBJSTLViewer from "../display/objStlViewer";
  import { setClaimedOrder } from "../../services/userInterfaceSlice";
import { resetDataState, setFulfillMode } from "../../services/dataSlice";
  
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
  
    const confirmClaim = () => {
      console.log(`✅ Confirmed claim of ${quantity} item(s)`);
      dispatch(setClaimedOrder({ claimedOrder: null }));
    };

    const handleCancel = () =>{
      dispatch(setClaimedOrder({ claimedOrder: null }));
      dispatch(resetDataState());
      dispatch(setFulfillMode({ fulfillMode: false }));
    }
  
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
          }}
        >
          {/* LEFT COLUMN — 3D VIEWER */}
          <Grid item xs={12} md={7}>
            <Paper
              elevation={4}
              sx={{
                borderRadius: 3,
                overflow: "hidden",
                height: 600,
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
  
          {/* RIGHT COLUMN — CLAIM PANEL */}
          <Grid item xs={12} md={5}>
            <Paper
              elevation={3}
              sx={{
                p: 4,
                borderRadius: 3,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
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
                You can claim up to{" "}
                <strong>{claimedOrder.quantity}</strong> items from this order.
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
                    if (
                      !isNaN(val) &&
                      val >= 1 &&
                      val <= claimedOrder.quantity
                    ) {
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
  
              {/* Confirm Button */}
              <Box display="flex" gap={2} width="100%" mt={2}>
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
        <Dialog
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          maxWidth="lg"
          fullWidth
        >
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
  