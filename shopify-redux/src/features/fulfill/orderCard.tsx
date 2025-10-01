import { Box, Typography, Card, CardContent, CardActions, Button } from "@mui/material";
import { Order } from "../../app/utility/interfaces";

export const OrderCard: React.FC<Order> = (order) => {
  const isOpen = order.status === "created";
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
        <Box mt={1}>
          {order.selectedFileType?.startsWith("image") && (
            <img
              src={order.selectedFile}
              alt={order.name}
              style={{ maxWidth: "100%", maxHeight: 200 }}
            />
          )}
        </Box>
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
      </CardActions>
    </Card>
  );
};
