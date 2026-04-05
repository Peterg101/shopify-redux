import React, { useState } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Card,
  CardContent,
  Chip,
  TextField,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import {
  Close,
  Remove,
  Add,
  Delete,
  ShoppingCartCheckout,
  ShoppingBasketOutlined,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { useGetUserBasketQuery } from "../../services/authApi";
import { useDeleteBasketItemMutation } from "../../services/dbApi";
import { useUpdateBasketQuantityMutation } from "../../services/basketItemApi";
import { selectTotalBasketValue } from "../../services/selectors";
import { createStripeCheckoutAndRedirect } from "../../services/fetchFileUtils";
import { BasketInformation } from "../../app/utility/interfaces";
import {
  monoFontFamily,
  borderSubtle,
  borderHover,
  glowSubtle,
  glowMedium,
} from "../../theme";

interface BasketPanelProps {
  open: boolean;
  onClose: () => void;
}

function BasketPanel({ open, onClose }: BasketPanelProps) {
  const { data: basketItems = [] } = useGetUserBasketQuery();
  const subtotal = useSelector(selectTotalBasketValue);
  const shippingEstimate = subtotal > 0 ? 4.99 : 0;
  const total = subtotal + shippingEstimate;
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);

  const handleCheckoutWithFitd = () => {
    setCheckoutDialogOpen(false);
    onClose();
    createStripeCheckoutAndRedirect();
  };

  const handleCheckoutWithCommunity = () => {
    setCheckoutDialogOpen(false);
    onClose();
    createStripeCheckoutAndRedirect(true);
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          maxHeight: "70vh",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderTop: `1px solid ${glowMedium}`,
          // Offset above the floating bar
          bottom: 56,
        },
      }}
      // Prevent backdrop from covering the floating bar
      slotProps={{
        backdrop: {
          sx: { bottom: 56 },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2.5,
          py: 2,
          borderBottom: `1px solid ${borderSubtle}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
          <ShoppingBasketOutlined fontSize="small" />
          Your Basket
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="close basket panel">
          <Close />
        </IconButton>
      </Box>

      {/* Scrollable item list */}
      <Box sx={{ overflowY: "auto", flex: 1, px: 2.5, py: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {basketItems.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <ShoppingBasketOutlined sx={{ fontSize: 48, color: "text.secondary", opacity: 0.2, mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              Your basket is empty
            </Typography>
          </Box>
        ) : (
          basketItems.map((item) => (
            <PanelItemCard key={item.task_id} item={item} />
          ))
        )}
      </Box>

      {/* Bottom summary + checkout */}
      {basketItems.length > 0 && (
        <Box
          sx={{
            px: 2.5,
            py: 2,
            borderTop: `1px solid ${borderSubtle}`,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">
              Items ({basketItems.length})
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: monoFontFamily }}>
              {"\u00a3"}{subtotal.toFixed(2)}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">
              Shipping
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: monoFontFamily }}>
              {"\u00a3"}{shippingEstimate.toFixed(2)}
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="subtitle2" fontWeight={600}>
              Total
            </Typography>
            <Typography
              variant="subtitle2"
              sx={{ fontFamily: monoFontFamily, fontWeight: 700, color: "primary.main" }}
            >
              {"\u00a3"}{total.toFixed(2)}
            </Typography>
          </Box>

          <Button
            variant="contained"
            color="primary"
            fullWidth
            startIcon={<ShoppingCartCheckout />}
            onClick={() => setCheckoutDialogOpen(true)}
            sx={{
              py: 1.2,
              fontWeight: 600,
              transition: "all 0.2s ease",
              "&:hover": {
                boxShadow: `0 0 20px ${borderHover}`,
              },
            }}
          >
            Proceed to Checkout
          </Button>
        </Box>
      )}

      {/* Checkout confirmation dialog */}
      <Dialog open={checkoutDialogOpen} onClose={() => setCheckoutDialogOpen(false)}>
        <DialogTitle>Checkout Confirmation</DialogTitle>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" gap={2} sx={{ pt: 1 }}>
            <Button variant="contained" color="primary" onClick={handleCheckoutWithFitd}>
              Checkout with FITD
            </Button>
            <Button variant="contained" color="primary" onClick={handleCheckoutWithCommunity}>
              Checkout with the community
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Drawer>
  );
}

/** Compact item card for the basket panel */
function PanelItemCard({ item }: { item: BasketInformation }) {
  const [quantity, setQuantity] = useState(item.quantity);
  const [updateBasketQuantity] = useUpdateBasketQuantityMutation();
  const [deleteItem] = useDeleteBasketItemMutation();

  const handleQuantityChange = (delta: number) => {
    const newQty = quantity + delta;
    if (newQty >= 1) {
      setQuantity(newQty);
      updateBasketQuantity({ task_id: item.task_id, quantity: newQty });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      setQuantity(parsed);
      updateBasketQuantity({ task_id: item.task_id, quantity: parsed });
    } else if (e.target.value === "") {
      setQuantity(0);
    }
  };

  const handleBlur = () => {
    if (quantity < 1 || isNaN(quantity)) {
      setQuantity(1);
      updateBasketQuantity({ task_id: item.task_id, quantity: 1 });
    }
  };

  return (
    <Card
      sx={{
        border: `1px solid ${borderSubtle}`,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          borderColor: borderHover,
          boxShadow: `0 0 16px ${glowSubtle}`,
        },
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        {/* Header: name + price */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="body1" fontWeight={600} noWrap sx={{ flex: 1, mr: 1 }}>
            {item.name}
          </Typography>
          <Typography
            variant="body1"
            sx={{ fontFamily: monoFontFamily, fontWeight: 700, color: "primary.main", flexShrink: 0 }}
          >
            {"\u00a3"}{(quantity * item.price).toFixed(2)}
          </Typography>
        </Box>

        {/* Material chips */}
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1.5 }}>
          <Chip label={item.technique} size="small" variant="outlined" />
          <Chip label={item.material} size="small" variant="outlined" />
          {item.colour && <Chip label={item.colour} size="small" variant="outlined" />}
        </Box>

        {/* Quantity row */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <IconButton size="small" onClick={() => handleQuantityChange(-1)} aria-label="decrease quantity">
            <Remove sx={{ fontSize: 16 }} />
          </IconButton>
          <TextField
            value={quantity}
            type="number"
            onChange={handleInputChange}
            onBlur={handleBlur}
            size="small"
            inputProps={{
              min: 1,
              style: { width: 36, textAlign: "center", padding: "4px" },
              inputMode: "numeric",
            }}
            sx={{
              "& input[type=number]": { MozAppearance: "textfield" },
              "& input[type=number]::-webkit-outer-spin-button": { WebkitAppearance: "none", margin: 0 },
              "& input[type=number]::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 },
            }}
          />
          <IconButton size="small" onClick={() => handleQuantityChange(1)} aria-label="increase quantity">
            <Add sx={{ fontSize: 16 }} />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton
            size="small"
            onClick={() => deleteItem(item.task_id)}
            aria-label="remove item"
            sx={{ color: 'error.main', '&:hover': { backgroundColor: 'rgba(255, 82, 82, 0.08)' } }}
          >
            <Delete sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
}

export default BasketPanel;
