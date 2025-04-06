import React, {useState} from "react";
import {BasketInformation, BasketQuantityUpdate } from "../../app/utility/interfaces";
import { Accordion, AccordionDetails, AccordionSummary, Typography, Box, Card, Divider, IconButton, TextField } from "@mui/material";
import { ExpandMore, ShoppingBasket, ColorLens, Inventory2, FormatSize, Construction, AttachMoney, Remove, Add } from "@mui/icons-material";
import DeleteFromBasket from "./deleteFromBasket";
import EditBasketItem from "./editBasketItem";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useFile } from "../../services/fileProvider";
import { updateBasketQuantity as updateValue } from "../../services/fetchFileUtils";
import { useUpdateBasketQuantityMutation } from "../../services/basketItemApi";

export const EmptyBasket = () => {
  return (
    <Box sx={{ textAlign: "center", py: 4 }}>
      <Typography variant="h6" color="text.secondary">
        Your basket is empty. Add a model to get started!
      </Typography>
    </Box>
  );
};

export const Basket = () => {
  const { actualFile, setActualFile } = useFile();
  const dispatch = useDispatch();
  const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2 }}>
      {userInterfaceState.userInformation?.basket_items.length === 0 ? (
        <EmptyBasket />
      ) : (
        userInterfaceState.userInformation?.basket_items.map((item) => (
          <BasketItemCard key={item.task_id} {...item} />
        ))
      )}
    </Box>
  );
};

const BasketItemCard: React.FC<BasketInformation> = (item) => {
  const [quantity, setQuantity] = useState(item.quantity);
  const [updateBasketQuantity] = useUpdateBasketQuantityMutation();

  const updateBasketQuantityObject = {
    task_id: item.task_id,
    quantity: quantity
  };

  const handleQuantityChange = (delta: number) => {
    console.log(delta)
    const newQuantity = quantity + delta;
    console.log(newQuantity)
    if (newQuantity >= 1) {
      setQuantity(newQuantity);
      // updateValue(updateBasketQuantityObject)
      updateBasketQuantity({ task_id: item.task_id, quantity: newQuantity });
            
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      console.log(value)
      setQuantity(parsed);
      // updateValue(updateBasketQuantityObject)
      updateBasketQuantity({task_id: item.task_id, quantity: parsed });
    } else if (value === "") {
      setQuantity(0); // temporarily allow clearing input
    }
  };

  const handleBlur = () => {
    if (quantity < 1 || isNaN(quantity)) {
      setQuantity(1); // fallback on blur
    }
  };

  return (
    <Card elevation={3} sx={{ borderRadius: 2, overflow: "hidden" }}>
      <Accordion sx={{ boxShadow: "none" }}>
        <AccordionSummary
          expandIcon={<ExpandMore />}
          aria-controls={`panel-${item.task_id}-content`}
          id={`panel-${item.task_id}-header`}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <ShoppingBasket color="primary" />
            <Typography variant="h6">{item.name}</Typography>
          </Box>
        </AccordionSummary>

        <AccordionDetails>
          <Divider sx={{ mb: 1 }} />
          <DetailRow icon={<Construction />} label="Technique" value={item.technique} />
          <DetailRow icon={<FormatSize />} label="Sizing" value={`${item.sizing}x`} />
          <DetailRow icon={<Inventory2 />} label="Material" value={item.material} />
          <DetailRow icon={<ColorLens />} label="Colour" value={item.colour} />

          {/* Quantity controls */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, my: 0.5 }}>
            <ShoppingBasket />
            <Typography variant="body1"><strong>Quantity:</strong></Typography>
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
                inputMode: "numeric", // improves mobile UX
              }}
              sx={{
                '& input[type=number]': {
                  MozAppearance: 'textfield',
                },
                '& input[type=number]::-webkit-outer-spin-button': {
                  WebkitAppearance: 'none',
                  margin: 0,
                },
                '& input[type=number]::-webkit-inner-spin-button': {
                  WebkitAppearance: 'none',
                  margin: 0,
                },
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
          />
        </AccordionDetails>

        <AccordionDetails>
          <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", mt: 1 }}>
            <DeleteFromBasket item={item} />
            <EditBasketItem item={item} />
          </Box>
        </AccordionDetails>
      </Accordion>
    </Card>
  );
};

const DetailRow = ({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, my: 0.5 }}>
    {icon}
    <Typography variant="body1">
      <strong>{label}:</strong> {value}
    </Typography>
  </Box>
);