import { Box } from "@mui/material"
import { useState } from "react";
import { FulfillableItems } from "./fulfillableItems";
import { ClaimedItems } from "./claimedItems";

export const FulfillOrClaimed = () => {

    const [fulfillMode, setFulfillMode] = useState(true)
    return(
        <Box>
            {(fulfillMode) ?
                        <FulfillableItems/>  :
                        <ClaimedItems/>
                        }
        </Box>
    )
}