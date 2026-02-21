import { Box, useTheme } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { HeaderBar } from "../userInterface/headerBar";
import { FulfillUserInterface } from "./fulfillUserInterface";
import { FulfillOrClaimed } from "./fulfilledOrClaimed";

export const Fulfill = () => {
    const theme = useTheme();
    const userInterfaceState = useSelector((state: RootState) => state.userInterfaceState);
    const collapsedWidth = `calc(${theme.spacing(8)} + 1px)`;

    return (
        <Box>
            <HeaderBar />
            <FulfillUserInterface />
            <Box
                sx={{
                    marginLeft: userInterfaceState.leftDrawerOpen
                        ? `${userInterfaceState.drawerWidth}px`
                        : collapsedWidth,
                    marginTop: `${theme.mixins.toolbar.minHeight}px`,
                    transition: theme.transitions.create(["margin"], {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.enteringScreen,
                    }),
                }}
            >
                <FulfillOrClaimed />
            </Box>
        </Box>
    )
}
