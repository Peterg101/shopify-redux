import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Typography,
    Box,
    Card,
    Divider,
    Chip,
    Button,
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
    Gavel,
    Public,
    Lock,
    OpenInNew,
  } from "@mui/icons-material";

  import { useState } from "react";
  import { useSelector, useDispatch } from "react-redux";
  import { useNavigate } from "react-router-dom";
  import { RootState } from "../../app/store";
  import { Order } from "../../app/utility/interfaces";
  import { toggleOrderVisibility } from "../../services/fetchFileUtils";
  import { authApi } from "../../services/authApi";

  export const EmptyOrderHistory = () => (
    <Box sx={{ textAlign: "center", py: 6 }}>
      <Typography variant="h6" color="text.secondary">
        Your order history is empty. Consume!
      </Typography>
    </Box>
  );



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

  export const OrderHistory = () => {
    const userInformation = useSelector(
      (state: RootState) => state.userInterfaceState.userInformation
    );
    const orders = userInformation?.orders;

    if (!orders) {
      return (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Typography variant="h6" color="text.secondary">
            Loading your orders...
          </Typography>
        </Box>
      );
    }

    if (orders.length === 0) {
      return <EmptyOrderHistory />;
    }

    return (
      <Box sx={{ px: 3, pt: 2 }}>
        <OrderList orders={orders} />
      </Box>
    );
  }

  const DISPUTE_STATUSES = ["disputed", "resolved_accepted", "resolved_partial", "resolved_rejected"];

  const ClaimStatusChip: React.FC<{ status: string }> = ({ status }) => {
    const colorMap: Record<string, "error" | "warning" | "success" | "default" | "info"> = {
      disputed: "error",
      resolved_accepted: "success",
      resolved_partial: "warning",
      resolved_rejected: "error",
      delivered: "info",
      shipped: "info",
      qa_check: "warning",
      pending: "default",
    };
    return (
      <Chip
        label={status.replace(/_/g, " ")}
        color={colorMap[status] || "default"}
        size="small"
        sx={{ fontWeight: 600 }}
      />
    );
  };

  const OrderedItemCard: React.FC<Order> = (item) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [toggling, setToggling] = useState(false);

    const handleToggleVisibility = async (e: React.MouseEvent) => {
      e.stopPropagation();
      setToggling(true);
      try {
        await toggleOrderVisibility(item.order_id);
        dispatch(authApi.util.invalidateTags(["sessionData"]));
      } catch (err) {
        console.error("Error toggling visibility:", err);
      } finally {
        setToggling(false);
      }
    };

    const disputeClaims = (item.claims || []).filter(
      (c) => DISPUTE_STATUSES.includes(c.status)
    );

    const hasDelivered = (item.claims || []).some((c) => c.status === "delivered");

    return (
      <Card elevation={4} sx={{ borderRadius: 3 }}>
        <Accordion sx={{ boxShadow: "none", borderRadius: 3 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, width: "100%" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ShoppingBasket color="primary" />
                <Typography variant="h6">{item.name}</Typography>
                {disputeClaims.length > 0 && (
                  <Chip
                    icon={<Gavel />}
                    label={`${disputeClaims.length} dispute${disputeClaims.length > 1 ? "s" : ""}`}
                    color="error"
                    size="small"
                    sx={{ ml: "auto" }}
                  />
                )}
                {hasDelivered && disputeClaims.length === 0 && (
                  <Chip
                    label="Review needed"
                    color="warning"
                    size="small"
                    sx={{ ml: "auto" }}
                  />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                Ordered: {new Date(item.created_at).toLocaleDateString()} · {item.quantity_claimed}/{item.quantity} claimed
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

            <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
              <Chip label={item.selectedFileType} variant="outlined" size="small" />
              <Chip
                icon={item.is_collaborative ? <Public /> : <Lock />}
                label={item.is_collaborative ? "Community" : "Private"}
                color={item.is_collaborative ? "success" : "default"}
                size="small"
                onClick={handleToggleVisibility}
                disabled={toggling}
                sx={{ cursor: "pointer" }}
              />
              <Typography variant="caption" color="text.secondary">
                {item.is_collaborative
                  ? "Visible to fulfillers"
                  : "Click to post to community"}
              </Typography>
            </Box>

            {/* Claims summary */}
            {item.claims && item.claims.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Claims ({item.claims.length})
                </Typography>
                {item.claims.map((claim) => (
                  <Box
                    key={claim.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 1,
                      px: 1.5,
                      mb: 1,
                      borderRadius: 2,
                      backgroundColor: "action.hover",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <ClaimStatusChip status={claim.status} />
                      <Typography variant="body2">
                        Qty: {claim.quantity}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {/* View Details button — navigates to full order detail page */}
            <Button
              variant="contained"
              fullWidth
              startIcon={<OpenInNew />}
              onClick={() => navigate(`/orders/${item.order_id}`)}
              sx={{ mt: 3, py: 1.2, borderRadius: 2, fontWeight: 600 }}
            >
              View Full Details
            </Button>
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
