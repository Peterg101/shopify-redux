import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Typography,
    Box,
    Card,
    Divider,
    Chip,
    Grid,
  } from "@mui/material";
  
  import {
    ExpandMore,
    ShoppingBasket,
    ColorLens,
    Inventory2,
    FormatSize,
    Construction,
    AttachMoney,
    ReceiptLong,
  } from "@mui/icons-material";
  
  import { useSelector } from "react-redux";
  import { RootState } from "../../app/store";
  import { Order } from "../../app/utility/interfaces";
  
  export const EmptyOrderHistory = () => (
    <Box sx={{ textAlign: "center", py: 6 }}>
      <Typography variant="h6" color="text.secondary">
        Your order history is empty. Consume!
      </Typography>
    </Box>
  );
  
  export const OrderHistory = () => {
    const orders = useSelector(
      (state: RootState) => state.userInterfaceState.userInformation?.orders
    ) as Order[] | undefined;
  
    const isEmpty = !orders || orders.length === 0;
  
    return (
      <Box sx={{ px: 3, pt: 2 }}>
        {isEmpty ? <EmptyOrderHistory /> : <OrderList orders={orders} />}
      </Box>
    );
  };
  
  export const OrderList = ({ orders }: { orders: Order[] }) => (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        maxWidth: "800px",
        mx: "auto",
        px: 2,
      }}
    >
      {orders.map((item) => (
        <OrderedItemCard key={item.order_id} {...item} />
      ))}
    </Box>
  );
  
  const OrderedItemCard: React.FC<Order> = (item) => {
    return (
      <Card elevation={4} sx={{ borderRadius: 3 }}>
        <Accordion sx={{ boxShadow: "none", borderRadius: 3 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ShoppingBasket color="primary" />
                <Typography variant="h6">{item.name}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Order placed: {new Date(item.created_at).toLocaleDateString()} · Status:{" "}
                <strong>{item.status}</strong>
              </Typography>
            </Box>
          </AccordionSummary>
  
          <AccordionDetails>
            <Divider sx={{ mb: 2 }} />
  
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <DetailRow icon={<Construction />} label="Technique" value={item.technique} />
              <DetailRow icon={<FormatSize />} label="Sizing" value={`${item.sizing}x`} />
              <DetailRow icon={<Inventory2 />} label="Material" value={item.material} />
              <DetailRow icon={<ColorLens />} label="Colour" value={item.colour} />
              <DetailRow icon={<AttachMoney />} label="Price" value={`$${item.price.toFixed(2)}`} />
              <DetailRow icon={<ReceiptLong />} label="Quantity" value={`${item.quantity}`} />
            </Box>
  
            <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
              <Chip label={item.selectedFileType} variant="outlined" size="small" />
              <Chip
                label={item.is_collaborative ? "Collaborative" : "Solo"}
                color="info"
                size="small"
              />
            </Box>
          </AccordionDetails>
        </Accordion>
      </Card>
    );
  };
  
  const DetailRow = ({
    icon,
    label,
    value,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
  }) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {icon}
      <Typography variant="body1">
        <strong>{label}:</strong> {value}
      </Typography>
    </Box>
  );