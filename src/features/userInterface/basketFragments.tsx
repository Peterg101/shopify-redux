import React from "react";
import { BasketItem } from "../../app/utility/interfaces";
import { Accordion, AccordionDetails, AccordionSummary, Button, Typography, Box } from '@mui/material';
import {ExpandMore} from '@mui/icons-material';
import DeleteFromBasket from "./deleteFromBasket";
import EditBasketItem from "./editBasketItem";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
  
export const EmptyBasket = () => {
  return (
    <React.Fragment>
      <h6>Please add a model to the basket</h6>
    </React.Fragment>
  );
};
  export const Basket = () => {
    const userInterfaceState = useSelector(
      (state: RootState) => state.userInterfaceState,
    )
    return(
    <React.Fragment>
      {userInterfaceState.basketItems.map((item) => (
        <CollapsibleButton key={item.id} {...item} />
      ))}
    </React.Fragment>
    )
  }

  export const CollapsibleButton: React.FC<BasketItem> = (item: BasketItem) => {
        return (
          <Accordion>
            <AccordionSummary
              expandIcon={<ExpandMore/>}
              aria-controls={`panel-${item.id}-content`}
              id={`panel-${item.id}-header`}
            >
              <Typography>{item.name}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>Technique: {item.technique}</Typography>
            </AccordionDetails>
            <AccordionDetails>
              <Typography>Sizing: {item.sizing}x</Typography>
            </AccordionDetails>
            <AccordionDetails>
              <Typography>Material: {item.material}</Typography>
            </AccordionDetails>
            <AccordionDetails>
              <Typography>Colour: {item.colour}</Typography>
            </AccordionDetails>
            <AccordionDetails>
              <Box display="flex" justifyContent="space-between" width="100%">
                <DeleteFromBasket
                  item={item}
                />
                <EditBasketItem
                  item={item}
                />
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      };
        