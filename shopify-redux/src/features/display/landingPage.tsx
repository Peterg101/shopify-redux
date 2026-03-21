import { Box } from "@mui/material"
import { useEffect } from "react";
import { useDispatch} from "react-redux";
import { HeaderBar } from "../userInterface/headerBar";
import { GenerateOrderOptions } from "./generateOrderOptions";
import { resetDataState } from "../../services/dataSlice";
import { setClaimedOrder, setFulfillMode, resetSidebar } from "../../services/userInterfaceSlice";

export const LandingPage = () => {
    const dispatch = useDispatch()

    useEffect(() => {
        dispatch(resetSidebar());
        return () => {
          dispatch(resetDataState());
          dispatch(setClaimedOrder({claimedOrder: null}))
          dispatch(setFulfillMode({fulfillMode: false}))
        };
      }, [dispatch]);

    return(
        <Box>
            <HeaderBar/>
            <GenerateOrderOptions/>
        </Box>
    )
}
