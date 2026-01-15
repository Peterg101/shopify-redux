import { Box, useTheme } from "@mui/material";
import { HeaderBar } from "../userInterface/headerBar"
import { UpdatedUserInterface } from "../userInterface/updatedUserInterface"
import { FulfillOptions } from "./fulfillOptions"
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { FulfillUserInterface } from "./fulfillUserInterface";
import { resetDataState, setFulfillMode } from "../../services/dataSlice";
import { ClaimMenu } from "./claimMenu";
import { FulfillOrClaimed } from "./fulfilledOrClaimed";

export const Fulfill = () => {

    const userInterfaceState = useSelector(
        (state: RootState) => state.userInterfaceState
      )
    return(
        <Box> 
            <HeaderBar/>
            <FulfillUserInterface/>
            <FulfillOrClaimed/>   
        </Box>
    )
}
