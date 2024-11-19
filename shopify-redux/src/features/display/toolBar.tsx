import { Box, TextField } from "@mui/material"
import { ClearFile } from "../userInterface/clearFile";
import { AddToBasket } from "../userInterface/addToBasket";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { ChangeEvent } from "react";
import { setFileNameBoxValue } from "../../services/dataSlice";

export const ToolBar = () => {

const dispatch = useDispatch();
const dataState = useSelector((state: RootState) => state.dataState)

const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch(setFileNameBoxValue({ fileNameBoxValue: event.target.value }));
    };
// Consolidated styles
const styles = {
    container: { mt: 4, mb: 4 },
    paper: { p: 2, display: 'flex', flexDirection: 'column', height: 850 },
    viewPort: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    fileBox: { textAlign: 'center', minHeight: '20px' },
    fileInput: { marginTop: 10 },
  };

    return(
        <Box sx={styles.viewPort}>
                <ClearFile />
                <Box sx={styles.fileBox}>
                  <TextField
                    value={dataState.fileNameBoxValue}
                    onChange={handleChange}
                  />
                </Box>
                <AddToBasket />
              </Box>
    )
}