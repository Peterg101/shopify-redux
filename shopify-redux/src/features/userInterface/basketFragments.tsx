import React from "react";
import { BasketItem, BasketInformation } from "../../app/utility/interfaces";
import { Accordion, AccordionDetails, AccordionSummary, Button, Typography, Box, Card, CardContent, Divider } from "@mui/material";
import { ExpandMore, ShoppingBasket, ColorLens, Inventory2, FormatSize } from "@mui/icons-material";
import DeleteFromBasket from "./deleteFromBasket";
import EditBasketItem from "./editBasketItem";
import { extractFileInfo, fetchFile } from "../../services/fetchFileUtils";
import { setLeftDrawerClosed } from "../../services/userInterfaceSlice";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useFile } from "../../services/fileProvider";
import { resetDataState, setFileProperties } from "../../services/dataSlice";

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

  const handleGetFile = async (fileId: string, filename: string) => {
    setActualFile(null);
    dispatch(resetDataState());
    dispatch(setLeftDrawerClosed());
    const data = await fetchFile(fileId);
    const fileInfo = extractFileInfo(data, filename);
    setActualFile(fileInfo.file);
    dispatch(
      setFileProperties({
        selectedFile: fileInfo.fileUrl,
        selectedFileType: "obj",
        fileNameBoxValue: filename,
      })
    );
  };

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