import React, { useState } from "react";
import {
  Typography,
  Box,
  Card,
  CardContent,
  Divider,
  IconButton,
  TextField,
  Button,
  Chip,
  Collapse,
  Dialog,

  DialogTitle,
  DialogContent,
} from "@mui/material";
import {
  Remove,
  Add,
  ShoppingCartCheckout,
  ReceiptLong,
  ExpandMore,
  ExpandLess,
  ShoppingBasketOutlined,
} from "@mui/icons-material";

import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useUpdateBasketQuantityMutation } from "../../services/basketItemApi";
import DeleteFromBasket from "./deleteFromBasket";
import EditBasketItem from "./editBasketItem";
import { BasketInformation } from "../../app/utility/interfaces";
import { setLeftDrawerClosed } from "../../services/userInterfaceSlice";
import { createStripeCheckoutAndRedirect } from "../../services/fetchFileUtils";
import { selectTotalBasketValue } from "../../services/selectors";
import { monoFontFamily } from "../../theme";

// Empty state
export const EmptyBasket = () => (
  <Box sx={{ textAlign: "center", py: 6 }}>
    <ShoppingBasketOutlined sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.2, mb: 2 }} />
    <Typography variant="h6" color="text.secondary">
      Your basket is empty
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.7 }}>
      Add a model to get started
    </Typography>
  </Box>
);

// Main Basket component
export const Basket = () => {
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);
  const isEmpty = userInterfaceState.userInformation?.basket_items.length === 0;

  return (
    <Box sx={{ px: 1, pt: 1 }}>
      {isEmpty ? <EmptyBasket /> : <BasketList />}
    </Box>
  );
};

// List of basket items
export const BasketList = () => {
  const basketItems = useSelector(
    (state: RootState) => state.userInterfaceState.userInformation?.basket_items || []
  ) as BasketInformation[];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, width: "100%" }}>
      <BasketSummary />
      {basketItems.map((item) => (
        <BasketItemCard key={item.task_id} {...item} />
      ))}
    </Box>
  );
};

// Individual item card
function BasketItemCard(item: BasketInformation) {
  const [quantity, setQuantity] = useState(item.quantity);
  const [showDetails, setShowDetails] = useState(false);
  const [updateBasketQuantity] = useUpdateBasketQuantityMutation();

  const handleQuantityChange = (delta: number) => {
    const newQty = quantity + delta;
    if (newQty >= 1) {
      setQuantity(newQty);
      updateBasketQuantity({ task_id: item.task_id, quantity: newQty });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      setQuantity(parsed);
      updateBasketQuantity({ task_id: item.task_id, quantity: parsed });
    } else if (value === "") {
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
        border: '1px solid rgba(0, 229, 255, 0.12)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: 'rgba(0, 229, 255, 0.3)',
          boxShadow: '0 0 16px rgba(0, 229, 255, 0.1)',
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header: name + price */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body1" fontWeight={600} noWrap sx={{ flex: 1, mr: 1 }}>
            {item.name}
          </Typography>
          <Typography
            variant="body1"
            sx={{ fontFamily: monoFontFamily, fontWeight: 700, color: 'primary.main', flexShrink: 0 }}
          >
            {'\u00a3'}{(quantity * item.price).toFixed(2)}
          </Typography>
        </Box>

        {/* Material chips */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
          <Chip label={item.technique} size="small" variant="outlined" />
          <Chip label={item.material} size="small" variant="outlined" />
          {item.colour && <Chip label={item.colour} size="small" variant="outlined" />}
        </Box>

        {/* Quantity row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                style: { width: 36, textAlign: "center", padding: '4px' },
                inputMode: "numeric",
              }}
              sx={{
                '& input[type=number]': { MozAppearance: 'textfield' },
                '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
                '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
              }}
            />
            <IconButton size="small" onClick={() => handleQuantityChange(1)} aria-label="increase quantity">
              <Add sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <EditBasketItem item={item} />
            <DeleteFromBasket item={item} />
          </Box>
        </Box>

        {/* Expandable details */}
        <Box
          onClick={() => setShowDetails(!showDetails)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mt: 1,
            cursor: 'pointer',
            color: 'text.secondary',
            '&:hover': { color: 'primary.main' },
          }}
        >
          <Typography variant="caption">{showDetails ? 'Hide details' : 'Show details'}</Typography>
          {showDetails ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
        </Box>
        <Collapse in={showDetails}>
          <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(0, 229, 255, 0.08)' }}>
            <DetailRow label="Sizing" value={`${item.sizing}x`} />
            <DetailRow label="Unit Price" value={`\u00a3${item.price.toFixed(2)}`} mono />
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

const DetailRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="caption" sx={mono ? { fontFamily: monoFontFamily } : undefined}>{value}</Typography>
  </Box>
);

// Sticky summary card
export const BasketSummary = () => {
  const [open, setOpen] = useState(false);
  const handleClose = () => setOpen(false);

  const basketItems = useSelector((state: RootState) => state.userInterfaceState.userInformation?.basket_items || []);
  const subtotal = useSelector(selectTotalBasketValue);
  const shippingEstimate = subtotal > 0 ? 4.99 : 0;
  const total = subtotal + shippingEstimate;
  const dispatch = useDispatch();

  const clickProceedToBasket = () => {
    setOpen(true);
  };

  const handleCheckoutWithFitd = () => {
    dispatch(setLeftDrawerClosed());
    setOpen(false);
    createStripeCheckoutAndRedirect();
  };

  const handleCheckoutWithCommunity = () => {
    dispatch(setLeftDrawerClosed());
    setOpen(false);
    createStripeCheckoutAndRedirect(true);
  };

  return (
    <Card
      sx={{
        p: 2.5,
        border: '1px solid rgba(0, 229, 255, 0.15)',
        backdropFilter: "blur(6px)",
        background: "rgba(19, 25, 32, 0.85)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3), 0 0 12px rgba(0, 229, 255, 0.05)",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
        <ReceiptLong fontSize="small" />
        Order Summary
      </Typography>

      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="body2" color="text.secondary">
          Items ({basketItems.length})
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: monoFontFamily }}>
          {'\u00a3'}{subtotal.toFixed(2)}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="body2" color="text.secondary">Shipping</Typography>
        <Typography variant="body2" sx={{ fontFamily: monoFontFamily }}>
          {'\u00a3'}{shippingEstimate.toFixed(2)}
        </Typography>
      </Box>

      <Divider />

      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="subtitle2" fontWeight={600}>Total</Typography>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: monoFontFamily, fontWeight: 700, color: 'primary.main' }}
        >
          {'\u00a3'}{total.toFixed(2)}
        </Typography>
      </Box>

      <Button
        onClick={clickProceedToBasket}
        variant="contained"
        size="medium"
        startIcon={<ShoppingCartCheckout />}
        color="primary"
        fullWidth
        sx={{
          mt: 0.5,
          py: 1.2,
          fontWeight: 600,
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)',
          },
        }}
      >
        Proceed to Checkout
      </Button>

      <Dialog open={open} onClose={handleClose} aria-labelledby="checkout-dialog-title" aria-describedby="checkout-dialog-description">
        <DialogTitle id="checkout-dialog-title">Checkout Confirmation</DialogTitle>
        <DialogContent id="checkout-dialog-description">
          <Box display="flex" justifyContent="center" alignItems="center" gap={2}>
            <Button variant="contained" color="primary" onClick={handleCheckoutWithFitd}>
              Checkout with FITD
            </Button>
            <Button variant="contained" color="primary" onClick={handleCheckoutWithCommunity}>
              Checkout with the community
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
