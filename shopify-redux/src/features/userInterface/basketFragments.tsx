import React from "react";
import {BasketInformation } from "../../app/utility/interfaces";
import { Accordion, AccordionDetails, AccordionSummary, Typography, Box, Card, Divider } from "@mui/material";
import { ExpandMore, ShoppingBasket, ColorLens, Inventory2, FormatSize } from "@mui/icons-material";
import DeleteFromBasket from "./deleteFromBasket";
import EditBasketItem from "./editBasketItem";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useFile } from "../../services/fileProvider";


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
  return (
    <Card elevation={3} sx={{ borderRadius: 2, overflow: "hidden" }}>
      <Accordion sx={{ boxShadow: "none" }}>
        <AccordionSummary expandIcon={<ExpandMore />} aria-controls={`panel-${item.task_id}-content`} id={`panel-${item.task_id}-header`}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <ShoppingBasket color="primary" />
            <Typography variant="h6">{item.name}</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Divider sx={{ mb: 1 }} />
          <DetailRow icon={<Inventory2 />} label="Technique" value={item.technique} />
          <DetailRow icon={<FormatSize />} label="Sizing" value={`${item.sizing}x`} />
          <DetailRow icon={<Inventory2 />} label="Material" value={item.material} />
          <DetailRow icon={<ColorLens />} label="Colour" value={item.colour} />
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

// Reusable Row Component for Basket Details
const DetailRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, my: 0.5 }}>
    {icon}
    <Typography variant="body1">
      <strong>{label}:</strong> {value}
    </Typography>
  </Box>
);