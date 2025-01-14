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
export const LandingPage = () => {


    const [actualFile, setActualFile] = useState<File | null>(null);
    const [messages, setMessages] = useState<string[]>([]);
    const [progress, setProgress] = useState<number | null>(null);
    const userInterfaceState = useSelector(
      (state: RootState) => state.userInterfaceState
    )
    const dispatch = useDispatch()
    useEffect(() => {
      if (userInterfaceState.userInformation?.incomplete_tasks) {
        const taskId = userInterfaceState.userInformation.incomplete_tasks[0].task_id
        console.log(taskId)

        createWebsocketConnection(taskId, dispatch, setActualFile )
      }
    }), [userInterfaceState.userInformation?.incomplete_tasks]

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
        console.log(sessionData)
        console.log(sessionError)
        

    }

    

    const handleLogOut = () =>{
        logOut()
    }

    return(
        <Box sx = {{marginTop: 10}}>
            <UserInterface/>
            
            <MainOptions/>
            <LoginDialog/>
            <Button onClick={handleLogin}>Call Google</Button>
            <Button onClick={handleCallProtectedEndpoint}>Call Protected Endpoint</Button>
            <Button onClick={handleLogOut}>Log Out</Button>
            <h1>HERE</h1>
            {userInterfaceState.meshyLoadedPercentage}
        </Box>
        
    )
}