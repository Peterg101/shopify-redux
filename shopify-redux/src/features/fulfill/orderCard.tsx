import { useState } from "react";
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";

import { Order } from "../../app/utility/interfaces";
import { useFile } from "../../services/fileProvider";

import {
  fetchFile,
  extractFileInfo,
} from "../../services/fetchFileUtils";

import {
  resetDataState,
  setFulfillFileViewProperties,
  setFulfillMode,
  setSelectedFile,
} from "../../services/dataSlice";
import { setClaimedOrder } from "../../services/userInterfaceSlice";

import OBJSTLViewer from "../display/objStlViewer";

export const OrderCard: React.FC<Order> = (order) => {
  const dispatch = useDispatch();
  const { actualFile, setActualFile } = useFile();

  const [open, setOpen] = useState(false);

  const userInterfaceState = useSelector(
    (state: RootState) => state.userInterfaceState
  );

  const isOpen = order.quantity !== order.quantity_claimed
  const isInProgress = order.quantity === order.quantity_claimed;

  /**
   * Fetches and prepares the OBJ/STL file for preview or claim
   */
  const prepareOrderFile = async (order: Order) => {
    const data = await fetchFile(order.task_id);
    if (!data) throw new Error("File not found or could not be fetched.");

    const fileInfo = extractFileInfo(data, order.name);
    if (!fileInfo?.fileUrl) throw new Error("Failed to extract file information.");

    setActualFile(fileInfo.file);
    dispatch(setSelectedFile({ selectedFile: fileInfo.fileUrl }));
    dispatch(setFulfillFileViewProperties({ order, fileInformation: fileInfo }));

    return fileInfo;
  };

  /**
   * Opens the 3D viewer for a selected order
   */
  const handleViewOrderItem = async (order: Order) => {
    try {
      await prepareOrderFile(order);
      dispatch(setFulfillMode({ fulfillMode: true }));
      setOpen(true);
    } catch (err) {
      console.error("Error fetching or preparing file:", err);
      alert("Sorry, this file could not be loaded.");
    }
  };

  /**
   * Claims an order and sets its file in state for ClaimMenu
   */
  const handleClaimOrderItem = async (order: Order) => {
    try {
      await prepareOrderFile(order);
      dispatch(setClaimedOrder({ claimedOrder: order }));
      console.log("✅ Claimed order set:", order.name);
    } catch (err) {
      console.error("Error preparing claimed file:", err);
      alert("Sorry, this file could not be loaded.");
    }
  };

  /**
   * Closes the viewer and resets data state
   */
  const handleClose = () => {
    dispatch(resetDataState());
    setOpen(false);
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6">{order.name}</Typography>

        <Typography variant="body2" color="text.secondary">
          Material: {order.material} | Technique: {order.technique} | Colour:{" "}
          {order.colour} | Size: {order.sizing}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          Required Quantity: {order.quantity} | Claimed Quantity: {order.quantity_claimed} 
        </Typography>

         <Typography variant="body2" color="text.secondary">
           Total order value: ${(order.price).toFixed(2)}
        </Typography>

        <Typography variant="body2" color="text.secondary">
           Price per unit: ${(order.price/order.quantity).toFixed(2)}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          Status: {order.status}{" "}
          {order.is_collaborative && "(Collaborative)"}
        </Typography>

        {/* Thumbnail (if image) */}
        {order.selectedFileType.startsWith("image") && (
          <Box mt={1}>
            <img
              src={order.selectedFile}
              alt={order.name}
              style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8 }}
            />
          </Box>
        )}
      </CardContent>

      <CardActions>
        {isOpen && (
          <Button
            size="small"
            variant="contained"
            onClick={() => handleClaimOrderItem(order)}
          >
            Claim
          </Button>
        )}

        {order.selectedFileType.includes("obj") && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleViewOrderItem(order)}
          >
            View
          </Button>
        )}
      </CardActions>

      {/* 3D Viewer Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>{order.name}</DialogTitle>
          <Box>
              <OBJSTLViewer />
        </Box>
          <DialogActions>
            <Button onClick={() => handleClose()}>Close</Button>
          </DialogActions>
        </Dialog>
    </Card>
  );
};
