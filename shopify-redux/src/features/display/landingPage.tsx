import { Box, Button } from "@mui/material"
import UserInterface from "../userInterface/userInterface"
import { MainOptions } from "./mainOptions"
import { useState, useEffect } from "react";
import { useGetSessionQuery, useLogOutMutation } from "../../services/authApi";
import { useSelector } from 'react-redux';
import { RootState } from "../../app/store";
import LoginDialog from "./loginDialogue";
import { MeshyPayload } from "../../services/meshyApi";
import { createWebsocketConnection } from "../../services/meshyWebsocket";
import { useDispatch} from "react-redux";
import { AppDispatch } from "../../app/store";
import { UpdatedUserInterface } from "../userInterface/updatedUserInterface";
export const LandingPage = () => {


    const [actualFile, setActualFile] = useState<File | null>(null);
    const [messages, setMessages] = useState<string[]>([]);
    const [progress, setProgress] = useState<number | null>(null);
    const userInterfaceState = useSelector(
      (state: RootState) => state.userInterfaceState
    )
    const dispatch = useDispatch()
    useEffect(() => {
      if (userInterfaceState.userInformation?.incomplete_task?.port) {
        const portId = userInterfaceState.userInformation?.incomplete_task.port.port_id;
        createWebsocketConnection(portId, dispatch, setActualFile);
      }
    }, [userInterfaceState.userInformation]);

    const {
      data: sessionData,
      error: sessionError,
      isLoading: isSessionLoading,
      refetch: refetchSession, 
    } = useGetSessionQuery();
    
    const [
      logOut, 
      { 
        data: logOutData, 
        error: logOutError, 
        isLoading: isLogOutLoading 
      }
    ] = useLogOutMutation();

    const handleLogin = () => {
        window.location.href = "http://localhost:2468/auth/google";
      };

    const handleCallProtectedEndpoint = () => {
        refetchSession()
    }

    

    const handleLogOut = () =>{
        logOut()
    }

    return(
        <Box sx = {{marginTop: 10}}>
            {/* <UserInterface/> */}
            <UpdatedUserInterface/>
            <MainOptions/>
            <LoginDialog/>
        </Box>
        
    )
}