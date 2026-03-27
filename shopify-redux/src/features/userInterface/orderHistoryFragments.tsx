import {
  Typography,
  Box,
  Card,
  CardContent,

  Chip,
  Button,
  Collapse,
} from "@mui/material";

import {
  Construction,
  Inventory2,
  ColorLens,
  Gavel,
  Public,
  Lock,
  OpenInNew,
  LocalShipping,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Order } from "../../app/utility/interfaces";
import { useToggleOrderVisibilityMutation } from "../../services/dbApi";
import { useGetUserOrdersQuery } from "../../services/authApi";
import { monoFontFamily } from "../../theme";

export const EmptyOrderHistory = () => (
  <Box sx={{ textAlign: "center", py: 6 }}>
    <LocalShipping sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.2, mb: 2 }} />
    <Typography variant="h6" color="text.secondary">
      No orders yet
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.7 }}>
      Your order history will appear here
    </Typography>
  </Box>
);

export const OrderList = ({ orders }: { orders: Order[] }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, width: "100%" }}>
    {orders.map((item) => (
      <OrderedItemCard key={item.order_id} {...item} />
    ))}
  </Box>
);

export const OrderHistory = () => {
  const { data: orders, isLoading } = useGetUserOrdersQuery();

  if (isLoading || !orders) {
    return (
      <Box sx={{ textAlign: "center", py: 6 }}>
        <Typography variant="body1" color="text.secondary">
          Loading your orders...
        </Typography>
      </Box>
    );
  }

  if (orders.length === 0) {
    return <EmptyOrderHistory />;
  }

  return (
    <Box sx={{ pt: 1 }}>
      <OrderList orders={orders} />
    </Box>
  );
};

const DISPUTE_STATUSES = ["disputed", "resolved_accepted", "resolved_partial", "resolved_rejected"];

function ClaimStatusChip({ status }: { status: string }) {
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
      sx={{ fontWeight: 600, fontSize: '0.7rem' }}
    />
  );
};

function OrderedItemCard(item: Order) {
  const navigate = useNavigate();
  const [toggleVisibility, { isLoading: toggling }] = useToggleOrderVisibilityMutation();
  const [showDetails, setShowDetails] = useState(false);

  const handleToggleVisibility = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleVisibility(item.order_id);
  };

  const disputeClaims = (item.claims || []).filter(
    (c) => DISPUTE_STATUSES.includes(c.status)
  );
  const hasDelivered = (item.claims || []).some((c) => c.status === "delivered");

  return (
    <Card
      sx={{
        border: '1px solid rgba(0, 229, 255, 0.12)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: 'rgba(0, 229, 255, 0.3)',
          boxShadow: '0 0 16px rgba(0, 229, 255, 0.1)',
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body1" fontWeight={600} noWrap sx={{ flex: 1, mr: 1 }}>
            {item.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            {disputeClaims.length > 0 && (
              <Chip
                icon={<Gavel sx={{ fontSize: 14 }} />}
                label={`${disputeClaims.length}`}
                color="error"
                size="small"
              />
            )}
            {hasDelivered && disputeClaims.length === 0 && (
              <Chip label="Review" color="warning" size="small" />
            )}
          </Box>
        </Box>

        {/* Meta line */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {new Date(item.created_at).toLocaleDateString()} · {item.quantity_claimed}/{item.quantity} claimed
        </Typography>

        {/* Chips row */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
          <Chip label={item.technique} size="small" variant="outlined" icon={<Construction sx={{ fontSize: 14 }} />} />
          <Chip label={item.material} size="small" variant="outlined" icon={<Inventory2 sx={{ fontSize: 14 }} />} />
          {item.colour && <Chip label={item.colour} size="small" variant="outlined" icon={<ColorLens sx={{ fontSize: 14 }} />} />}
          <Chip
            icon={item.is_collaborative ? <Public sx={{ fontSize: 14 }} /> : <Lock sx={{ fontSize: 14 }} />}
            label={item.is_collaborative ? "Community" : "Private"}
            color={item.is_collaborative ? "success" : "default"}
            size="small"
            onClick={handleToggleVisibility}
            disabled={toggling}
            sx={{ cursor: "pointer" }}
          />
        </Box>

        {/* Price */}
        <Typography
          variant="body2"
          sx={{ fontFamily: monoFontFamily, fontWeight: 600, color: 'primary.main', mb: 1 }}
        >
          {'\u00a3'}{item.price.toFixed(2)} x {item.quantity}
        </Typography>

        {/* Expandable claims */}
        {item.claims && item.claims.length > 0 && (
          <>
            <Box
              onClick={() => setShowDetails(!showDetails)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'text.secondary',
                '&:hover': { color: 'primary.main' },
              }}
            >
              <Typography variant="caption">
                {item.claims.length} claim{item.claims.length > 1 ? 's' : ''}
              </Typography>
              {showDetails ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
            </Box>
            <Collapse in={showDetails}>
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(0, 229, 255, 0.08)' }}>
                {item.claims.map((claim) => (
                  <Box
                    key={claim.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 0.5,
                      px: 1,
                      mb: 0.5,
                      borderRadius: 1,
                      backgroundColor: "rgba(0, 229, 255, 0.03)",
                    }}
                  >
                    <ClaimStatusChip status={claim.status} />
                    <Typography variant="caption" color="text.secondary">
                      Qty: {claim.quantity}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Collapse>
          </>
        )}

        {/* View Details */}
        <Button
          variant="outlined"
          fullWidth
          size="small"
          startIcon={<OpenInNew sx={{ fontSize: 14 }} />}
          onClick={() => navigate(`/orders/${item.order_id}`)}
          sx={{ mt: 1.5, fontSize: '0.75rem' }}
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  );
};
