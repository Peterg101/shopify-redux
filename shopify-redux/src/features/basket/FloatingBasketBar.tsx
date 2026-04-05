import React, { useState } from "react";
import { Box, Typography, Button, Slide } from "@mui/material";
import { ShoppingBasket } from "@mui/icons-material";
import { useSelector } from "react-redux";
import { useGetUserBasketQuery } from "../../services/authApi";
import { selectTotalBasketValue, selectIsLoggedIn } from "../../services/selectors";
import { monoFontFamily, borderSubtle, borderHover } from "../../theme";
import BasketPanel from "./BasketPanel";

const bgSurface = "#131920";

function FloatingBasketBar() {
  const [panelOpen, setPanelOpen] = useState(false);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const { data: basketItems = [] } = useGetUserBasketQuery(undefined, { skip: !isLoggedIn });
  const subtotal = useSelector(selectTotalBasketValue);

  const itemCount = basketItems.length;
  const visible = isLoggedIn && itemCount > 0;

  return (
    <>
      <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            height: 56,
            display: "flex",
            alignItems: "center",
            px: 2.5,
            gap: 1.5,
            backgroundColor: bgSurface,
            borderTop: `1px solid ${borderHover}`,
            backdropFilter: "blur(12px)",
            boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.4)",
          }}
        >
          <ShoppingBasket sx={{ color: "primary.main", fontSize: 22 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </Typography>

          <Box sx={{ flex: 1 }} />

          <Typography
            variant="body1"
            sx={{
              fontFamily: monoFontFamily,
              fontWeight: 700,
              color: "primary.main",
              mr: 1.5,
            }}
          >
            {"\u00a3"}{subtotal.toFixed(2)}
          </Typography>

          <Button
            variant="outlined"
            size="small"
            onClick={() => setPanelOpen((prev) => !prev)}
            sx={{
              borderColor: borderSubtle,
              fontWeight: 600,
              px: 2,
              "&:hover": {
                borderColor: "primary.main",
                boxShadow: "0 0 12px rgba(0, 229, 255, 0.2)",
              },
            }}
          >
            View Basket
          </Button>
        </Box>
      </Slide>

      <BasketPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}

export default FloatingBasketBar;
