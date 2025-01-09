import React from "react";
import { BasketItem, BasketInformation } from "../../app/utility/interfaces";
import { Accordion, AccordionDetails, AccordionSummary, Button, Typography, Box } from '@mui/material';
import {ExpandMore} from '@mui/icons-material';
import DeleteFromBasket from "./deleteFromBasket";
import EditBasketItem from "./editBasketItem";
import { extractFileInfo, fetchFile } from "../../services/fetchFileUtils";
import { setLeftDrawerClosed } from "../../services/userInterfaceSlice";
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { useFile } from "../../services/fileProvider";
import { resetDataState, setFileProperties } from "../../services/dataSlice";
  
export const EmptyBasket = () => {
  return (
    <React.Fragment>
      <h6>Please add a model to the basket</h6>
    </React.Fragment>
  );
};
  export const Basket = () => {
    const { actualFile, setActualFile } = useFile();
    const dispatch = useDispatch();
    const userInterfaceState = useSelector(
      (state: RootState) => state.userInterfaceState,
    )

    const handleGetFile = async (fileId: string, filename: string) => {
      console.log(filename);
      console.log(fileId)
      setActualFile(null)
      dispatch(resetDataState())
      dispatch(setLeftDrawerClosed())
      const data = await fetchFile(fileId)
      const fileInfo = extractFileInfo(data, filename)
      setActualFile(fileInfo.file);
          dispatch(setFileProperties({
              selectedFile: fileInfo.fileUrl,
              selectedFileType: 'obj',
              fileNameBoxValue: filename,
          }));
      
  };
    console.log(userInterfaceState.userInformation?.basket_items)
    return(
    <React.Fragment>
      {userInterfaceState.userInformation?.basket_items.map((item) => (
        <CollapsibleButton key={item.task_id} {...item} />
      ))}
    </React.Fragment>
    )
  }

  export const CollapsibleButton: React.FC<BasketInformation> = (item: BasketInformation) => {
        return (
          <div>
          <Accordion>
            <AccordionSummary
              expandIcon={<ExpandMore/>}
              aria-controls={`panel-${item.task_id}-content`}
              id={`panel-${item.task_id}-header`}
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
              <Box sx = {{display:"flex", justifyContent:"space-between", width:"100%"}}>
                {/* <DeleteFromBasket
                  item={item}
                /> */}
                <EditBasketItem
                  item={item}
                />
              </Box>
            </AccordionDetails>
          </Accordion>
          </div>
        );
      };
        