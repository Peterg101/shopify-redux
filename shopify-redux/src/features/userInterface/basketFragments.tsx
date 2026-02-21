import React, { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
  Box,
  Card,
  Divider,
  IconButton,
  TextField,
  Button,
  Grid,
  useMediaQuery,
  useTheme,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import {
  ExpandMore,
  ShoppingBasket,
  ColorLens,
  Inventory2,
  FormatSize,
  Construction,
  AttachMoney,
  Remove,
  Add,
  ShoppingCartCheckout,
  ReceiptLong,
} from "@mui/icons-material";

import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useGenerateTasksFromBasketMutation, useUpdateBasketQuantityMutation } from "../../services/basketItemApi";
import DeleteFromBasket from "./deleteFromBasket";
import EditBasketItem from "./editBasketItem";
import { BasketInformation } from "../../app/utility/interfaces";
import { setLeftDrawerClosed } from "../../services/userInterfaceSlice";
import { createShopifyCheckoutAndRedirect } from "../../services/fetchFileUtils";
import { selectTotalBasketValue } from "../../services/selectors";
import { monoFontFamily } from "../../theme";

// Empty state
export const EmptyBasket = () => (
  <Box sx={{ textAlign: "center", py: 6 }}>
    <Typography variant="h6" color="text.secondary">
      Your basket is empty. Add a model to get started!
    </Typography>
  </Box>
);

// Main Basket component
export const Basket = () => {
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);

  const isEmpty = userInterfaceState.userInformation?.basket_items.length === 0;

  return (
    <Box sx={{ px: 3, pt: 2 }}>
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
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        width: "100%",
        maxWidth: "100%",
        mx: "auto",         // Center it
        px: 2,              // Padding for smaller screens
      }}
    >
      <BasketSummary />

      {basketItems.map((item) => (
        <BasketItemCard key={item.task_id} {...item} />
      ))}

    </Box>
  );
};
// Individual item card
const BasketItemCard: React.FC<BasketInformation> = (item) => {
  const [quantity, setQuantity] = useState(item.quantity);
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
    <Card elevation={4} sx={{ borderRadius: 3 }}>
      <Accordion sx={{ boxShadow: "none", borderRadius: 3 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <ShoppingBasket color="primary" />
            <Typography variant="h6">{item.name}</Typography>
          </Box>
        </AccordionSummary>

        <AccordionDetails>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: "grid", gap: 1.5 }}>
            <DetailRow icon={<Construction />} label="Technique" value={item.technique} />
            <DetailRow icon={<FormatSize />} label="Sizing" value={`${item.sizing}x`} />
            <DetailRow icon={<Inventory2 />} label="Material" value={item.material} />
            <DetailRow icon={<ColorLens />} label="Colour" value={item.colour} />

            {/* Quantity */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ShoppingBasket />
              <Typography variant="body1" fontWeight={500}>
                Quantity:
              </Typography>
              <IconButton size="small" onClick={() => handleQuantityChange(-1)}>
                <Remove />
              </IconButton>
              <TextField
                value={quantity}
                type="number"
                onChange={handleInputChange}
                onBlur={handleBlur}
                size="small"
                inputProps={{
                  min: 1,
                  style: { width: 40, textAlign: "center" },
                  inputMode: "numeric",
                }}
                sx={{
                  '& input[type=number]': { MozAppearance: 'textfield' },
                  '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
                  '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                }}
              />
              <IconButton size="small" onClick={() => handleQuantityChange(1)}>
                <Add />
              </IconButton>
            </Box>

            <DetailRow
              icon={<AttachMoney />}
              label="Price"
              value={`£${(quantity * item.price).toFixed(2)}`}
              mono
            />
          </Box>

          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 2 }}>
            <DeleteFromBasket item={item} />
            <EditBasketItem item={item} />
          </Box>
        </AccordionDetails>
      </Accordion>
    </Card>
  );
};

// Row used inside cards
const DetailRow = ({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
    {icon}
    <Typography variant="body1" sx={mono ? { fontFamily: monoFontFamily } : undefined}>
      <strong>{label}:</strong> {value}
    </Typography>
  </Box>
);

// Bottom total on list
const BasketTotal = () => {
  const total = useSelector(selectTotalBasketValue)

  return (
    <Box sx={{ textAlign: "right", pr: 1 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, fontFamily: monoFontFamily }}>
        Total: £{total.toFixed(2)}
      </Typography>
    </Box>
  );
};

// Sticky summary card
export const BasketSummary = () => {
  const [open, setOpen] = useState(false);
  const handleClose = () => setOpen(false);

  const user_id = useSelector((state:RootState) => state.userInterfaceState.userInformation.user.user_id)
  const basketItems = useSelector((state: RootState) => state.userInterfaceState.userInformation?.basket_items || []);
  const subtotal = useSelector(selectTotalBasketValue)
  const shippingEstimate = subtotal > 0 ? 4.99 : 0;
  const total = subtotal + shippingEstimate;
  const [generateTasksFromBasket] = useGenerateTasksFromBasketMutation()
  const dispatch = useDispatch()
  const clickProceedToBasket = () => {
    setOpen(true)
  }

  const handleCheckoutWithFitd = () =>{
    dispatch(setLeftDrawerClosed())
    setOpen(false)
    createShopifyCheckoutAndRedirect()
  }

  const handleCheckoutWithCommunity = () => {
    console.log("HERE WE GOOOOOOOOOO")
  }

  return (
    <Card
  elevation={6}
  sx={{
    p: 3,
    borderRadius: 3,
    backdropFilter: "blur(6px)",
    background: "rgba(19, 25, 32, 0.85)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3), 0 0 12px rgba(0, 229, 255, 0.05)",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  }}
>
      <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
        <ReceiptLong fontSize="medium" />
        Order Summary
      </Typography>

      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography color="text.secondary">Subtotal</Typography>
        <Typography sx={{ fontFamily: monoFontFamily }}>£{subtotal.toFixed(2)}</Typography>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography color="text.secondary">Shipping Estimate</Typography>
        <Typography sx={{ fontFamily: monoFontFamily }}>£{shippingEstimate.toFixed(2)}</Typography>
      </Box>

      <Divider />

      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="h6">Total</Typography>
        <Typography variant="h6" sx={{ fontFamily: monoFontFamily }}>£{total.toFixed(2)}</Typography>
      </Box>

      <Button
        onClick={clickProceedToBasket}
        variant="contained"
        size="large"
        startIcon={<ShoppingCartCheckout />}
        color="primary"
        fullWidth
        sx={{
          borderRadius: 2,
          mt: 1,
          py: 1.5,
          fontWeight: 600,
          fontSize: "1rem",
        }
        
      }
      >
        Proceed to Checkout
      </Button>
      <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Checkout Confirmation</DialogTitle>
      <DialogContent>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          gap={2} // spacing between buttons
        >
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
