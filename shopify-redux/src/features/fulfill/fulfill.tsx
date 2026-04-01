import { Box } from "@mui/material";
import { HeaderBar } from "../userInterface/headerBar";
import { FulfillOrClaimed } from "./fulfilledOrClaimed";

export const Fulfill = () => {
    return (
        <Box>
            <HeaderBar />
            <Box sx={{ pt: 10 }}>
                <FulfillOrClaimed />
            </Box>
        </Box>
    )
}
