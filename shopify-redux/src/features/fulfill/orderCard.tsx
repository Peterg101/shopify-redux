import { useState } from "react";
import {
  Card, CardContent, CardActions,
  Typography, Button, Box, Dialog
} from "@mui/material";
import { Order } from "../../app/utility/interfaces";
import { ObjPopUpViewer } from "./objPopUpViewer"; // new component
import OBJScene from "../display/objScene";
import { useFile } from "../../services/fileProvider";
import { extractFileInfo, fetchFile } from "../../services/fetchFileUtils";
import { useDispatch } from "react-redux";
import { setFulfillFileViewProperties, setSelectedFile } from "../../services/dataSlice";
import OBJSTLViewer from "../display/objStlViewer";

export const OrderCard: React.FC<Order> = (order) => {
  const [open, setOpen] = useState(false);
  const {actualFile, setActualFile} = useFile()
  const dispatch = useDispatch()
  const handleView = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const isOpen = order.status === "open";
  const isInProgress = order.status === "in_progress";


  const handleViewOrderItem = async (order: Order) => {
    console.log("VIEWWWWWW")
    try {
      const data = await fetchFile(order.task_id);
      if (!data) {
        throw new Error("File not found or could not be fetched.");
      }
  
      const fileInfo = extractFileInfo(data, order.name);
      console.log(fileInfo.file)
      if (!fileInfo?.fileUrl) {
        throw new Error("Failed to extract file information.");
      }
  
      setActualFile(fileInfo.file);
      dispatch(setSelectedFile({ selectedFile: fileInfo.fileUrl }));
      dispatch(setFulfillFileViewProperties({
        order: order,
        fileInformation: fileInfo
      }));
  
      setOpen(true);
  
    } catch (err) {
      console.error("Error fetching or preparing file:", err);
      alert("Sorry, this file could not be loaded."); // fallback UI
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6">{order.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          Material: {order.material} | Technique: {order.technique} | Colour: {order.colour} | Size: {order.sizing}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Quantity: {order.quantity} | Price: ${order.price.toFixed(2)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Status: {order.status} {order.is_collaborative && "(Collaborative)"}
        </Typography>

        {/* Thumbnail if it's an image */}
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
          <Button size="small" variant="contained">
            Claim
          </Button>
        )}
        {isInProgress && (
          <Button size="small" variant="outlined">
            Complete
          </Button>
        )}
        {order.selectedFileType.includes("obj") && (
          <Button size="small" variant="outlined" onClick={() => handleViewOrderItem(order)}>
            View
          </Button>
        )}
      </CardActions>

      {/* Modal with 3D viewer */}
      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <Box sx={{ height: "600px" }}>
      {order.selectedFileType.includes("obj") ? (
        <OBJSTLViewer />
      ) : (
        <Typography sx={{ p: 3 }}>No 3D preview available.</Typography>
      )}
      </Box>
      </Dialog>
    </Card>
  );
};
