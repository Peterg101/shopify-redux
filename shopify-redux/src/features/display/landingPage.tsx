import { Box, Button } from "@mui/material"
import { useState, useEffect } from "react";
import { useGetSessionQuery, useLogOutMutation } from "../../services/authApi";
import { useSelector } from 'react-redux';
import { RootState } from "../../app/store";
import { createWebsocketConnection } from "../../services/meshyWebsocket";
import { useDispatch} from "react-redux";
import { useSyncTotalCost } from "../../hooks/useSyncTotalCost";
import { useSyncTotalBasketCost } from "../../hooks/useSyncTotalBasketCost";
import { HeaderBar } from "../userInterface/headerBar";
import { GenerateOrderOptions } from "./generateOrderOptions";
import { resetDataState, setFulfillMode } from "../../services/dataSlice";
import { setClaimedOrder } from "../../services/userInterfaceSlice";
import { Fulfill } from "../fulfill/fullfill";
export const LandingPage = () => {

    const dispatch = useDispatch()
    useEffect(() => {
        return () => {
          dispatch(resetDataState());
          dispatch(setClaimedOrder({claimedOrder: null}))
          dispatch(setFulfillMode({fulfillMode: false}))
        };
      }, []);
    return(
        <Box sx = {{marginTop: 10}}>
            <HeaderBar/>
            <GenerateOrderOptions/>
        </Box>
        
    )
}