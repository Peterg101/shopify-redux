import { Box } from "@mui/material"
import { useSelector } from "react-redux"
import { FulfillOptions } from "./fulfillOptions"
import { ClaimMenu } from "./claimMenu";
import { RootState } from "../../app/store";
import { useState } from "react";

export const FulfillableItems = () => {
        const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState)
        return(
        <Box>
            {(!userInterfaceState?.claimedOrder) ?
                        <FulfillOptions/>  :
                        <ClaimMenu/>
                        }
        </Box>
    )
}