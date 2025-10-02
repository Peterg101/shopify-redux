import { Box, useTheme } from "@mui/material";
import { HeaderBar } from "../userInterface/headerBar"
import { UpdatedUserInterface } from "../userInterface/updatedUserInterface"
import { FulfillOptions } from "./fulfillOptions"
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { FulfillUserInterface } from "./fulfillUserInterface";
import { resetDataState, setFulfillMode } from "../../services/dataSlice";

export const Fulfill = () => {
    
    
    return(
        <Box> 
            <HeaderBar/>
            <FulfillUserInterface/>
            <FulfillOptions/>
        </Box>
    )
}
