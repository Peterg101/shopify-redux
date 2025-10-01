import { useState } from "react";
import {
  Card, CardContent, CardActions,
  Typography, Button, Box, Dialog
} from "@mui/material";
import { Order } from "../../app/utility/interfaces";
import { ObjPopUpViewer } from "./objPopUpViewer"; // new component

export const OrderCard: React.FC<Order> = (order) => {
  const [open, setOpen] = useState(false);

  const handleView = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const isOpen = order.status === "open";
  const isInProgress = order.status === "in_progress";

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
          <Button size="small" variant="outlined" onClick={handleView}>
            View
          </Button>
        )}
      </CardActions>

      {/* Modal with 3D viewer */}
      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
        <Box sx={{ height: "600px" }}>
          <ObjPopUpViewer url={order.selectedFile} />
        </Box>
      </Dialog>
    </Card>
  );
};
